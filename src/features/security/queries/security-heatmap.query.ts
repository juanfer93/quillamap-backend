export const SECURITY_HEATMAP_QUERY = `
with eligible_reports as (
  select
    r.id,
    r.danger_level,
    r.image_url,
    r."createdAt",
    p.karma as karma_score,
    ST_Transform(r.location::geometry, 3857) as cluster_geom,
    ST_DWithin(r.location, ST_GeogFromText($11), $12) as is_main_road,
    (
      extract(isodow from (r."createdAt" at time zone $13)) between 1 and 5
      and (
        extract(hour from (r."createdAt" at time zone $13)) between 6 and 8
        or extract(hour from (r."createdAt" at time zone $13)) between 17 and 19
      )
    ) as is_peak_hour,
    (
      r."createdAt" >= $14::timestamptz
      and r.image_url is not null
      and r.image_url like $15
    ) as has_verified_evidence,
    count(v.id) filter (where v."isConfirmed" = false) as negative_votes
  from report r
  inner join profile p on p.id = r."profileId"
  left join report_validations v on v."reportId" = r.id
  where r.type = $1
    and r.status = $2
    and coalesce(p.karma, 0) >= $3
    and ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
      $6
    )
    and (
      $7::boolean = false
      or ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
        greatest($8, $6)
      )
    )
  group by r.id, p.karma
  having count(v.id) filter (where v."isConfirmed" = false) < $9
),
clustered_reports as (
  select
    *,
    ST_ClusterDBSCAN(cluster_geom, eps := $10, minpoints := $16) over () as cluster_id
  from eligible_reports
),
scored_reports as (
  select
    *,
    least(
      1.0,
      greatest(
        0.05,
        (
          $17::numeric
          * case when has_verified_evidence then $19::numeric else 1 end
          * case when is_main_road and is_peak_hour then $18::numeric else 1 end
          * case
              when karma_score >= 20 then 1.1
              when karma_score >= 5 then 1.0
              else 0.85
            end
        )
      )
    ) as veracity_score
  from clustered_reports
  where cluster_id is not null
),
weighted_reports as (
  select
    *,
    least(1.0, greatest(0.05, (danger_level::numeric / 5.0) * veracity_score))
      as weighted_intensity
  from scored_reports
),
cluster_rollup as (
  select
    cluster_id,
    ST_Centroid(ST_Collect(cluster_geom)) as center_3857,
    least(1.0, avg(weighted_intensity)) as intensity,
    avg(veracity_score) as veracity_score,
    round(avg(danger_level)) as danger_level,
    count(*) as report_count,
    bool_or(has_verified_evidence) as has_verified_evidence,
    min("createdAt") as generated_from,
    max("createdAt") as generated_to,
    ST_Collect(cluster_geom) as cluster_collection
  from weighted_reports
  group by cluster_id
)
select
  cluster_id::text as "clusterId",
  ST_X(ST_Transform(center_3857, 4326)) as longitude,
  ST_Y(ST_Transform(center_3857, 4326)) as latitude,
  round(intensity::numeric, 4) as intensity,
  danger_level::int as "dangerLevel",
  round(veracity_score::numeric, 4) as "veracityScore",
  report_count::int as "reportCount",
  greatest(
    round(coalesce(ST_MaxDistance(center_3857, cluster_collection), $10)::numeric, 2),
    50
  ) as "radiusMeters",
  case
    when intensity >= 0.8 or danger_level >= 5 then 'critical'
    when intensity >= 0.6 or danger_level >= 4 then 'high'
    when intensity >= 0.35 or danger_level >= 3 then 'medium'
    else 'low'
  end as "riskLevel",
  has_verified_evidence as "hasVerifiedEvidence",
  generated_from as "generatedFrom",
  generated_to as "generatedTo"
from cluster_rollup
where $7::boolean = false
  or intensity >= 0.6
  or danger_level >= 4
order by intensity desc, report_count desc
limit 100
`;