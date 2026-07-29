-- QuillaMap AMB thermal comfort snippet for OSRM foot.lua
--
-- Scope:
-- - Use only after clipping the PBF to the AMB bounding box:
--   -75.10,10.82,-74.68,11.12
-- - Paste this near the top-level helpers/constants of the OSRM foot profile.
-- - Call apply_quillamap_thermal_comfort(way, result) after the base walking
--   speed/rate has been assigned for a routable pedestrian way.
--
-- Expected optional baked tags:
-- - quillamap:shade=community_report|green_coverage|tree|park|grass|none
-- - quillamap:shade_score=0..1
--
-- The community/green tags should be injected by your Extract/Partition/
-- Customize preprocessing around the AMB shade reports and Overpass layer.

local QUILLAMAP_THERMAL_COMFORT = {
  shaded_rate_multiplier = 0.72,
  partial_shade_rate_multiplier = 0.86,
  unshaded_rate_multiplier = 1.18,
  shaded_speed_bonus = 1.14,
  partial_shade_speed_bonus = 1.06,
  unshaded_speed_penalty = 0.92,
  tree_speed_bonus = 1.08,
  park_speed_bonus = 1.06,
}

local function quillamap_number_or_nil(value)
  if value == nil then
    return nil
  end

  return tonumber(value)
end

local function quillamap_is_green_coverage(way)
  return way:get_value_by_key('natural') == 'tree'
    or way:get_value_by_key('leisure') == 'park'
    or way:get_value_by_key('landuse') == 'grass'
end

local function quillamap_get_shade_factor(way)
  local baked_shade = way:get_value_by_key('quillamap:shade')

  if baked_shade == 'community_report'
    or baked_shade == 'green_coverage'
    or baked_shade == 'tree'
    or baked_shade == 'park'
    or baked_shade == 'grass' then
    return 1
  end

  local score = quillamap_number_or_nil(way:get_value_by_key('quillamap:shade_score'))

  if score ~= nil then
    if score >= 0.67 then
      return 1
    end

    if score >= 0.34 then
      return 0.5
    end
  end

  if quillamap_is_green_coverage(way) then
    return 0.5
  end

  return 0
end

local function quillamap_multiply_result(result, key, multiplier)
  if result[key] ~= nil then
    result[key] = result[key] * multiplier
  end
end

function apply_quillamap_thermal_comfort(way, result)
  local highway = way:get_value_by_key('highway')

  if highway == nil or highway == 'motorway' or highway == 'motorway_link' then
    return
  end

  local shade_factor = quillamap_get_shade_factor(way)

  if shade_factor >= 1 then
    quillamap_multiply_result(result, 'forward_rate', QUILLAMAP_THERMAL_COMFORT.shaded_rate_multiplier)
    quillamap_multiply_result(result, 'backward_rate', QUILLAMAP_THERMAL_COMFORT.shaded_rate_multiplier)
    quillamap_multiply_result(result, 'forward_speed', QUILLAMAP_THERMAL_COMFORT.shaded_speed_bonus)
    quillamap_multiply_result(result, 'backward_speed', QUILLAMAP_THERMAL_COMFORT.shaded_speed_bonus)
  elseif shade_factor > 0 then
    quillamap_multiply_result(result, 'forward_rate', QUILLAMAP_THERMAL_COMFORT.partial_shade_rate_multiplier)
    quillamap_multiply_result(result, 'backward_rate', QUILLAMAP_THERMAL_COMFORT.partial_shade_rate_multiplier)
    quillamap_multiply_result(result, 'forward_speed', QUILLAMAP_THERMAL_COMFORT.partial_shade_speed_bonus)
    quillamap_multiply_result(result, 'backward_speed', QUILLAMAP_THERMAL_COMFORT.partial_shade_speed_bonus)
  else
    quillamap_multiply_result(result, 'forward_rate', QUILLAMAP_THERMAL_COMFORT.unshaded_rate_multiplier)
    quillamap_multiply_result(result, 'backward_rate', QUILLAMAP_THERMAL_COMFORT.unshaded_rate_multiplier)
    quillamap_multiply_result(result, 'forward_speed', QUILLAMAP_THERMAL_COMFORT.unshaded_speed_penalty)
    quillamap_multiply_result(result, 'backward_speed', QUILLAMAP_THERMAL_COMFORT.unshaded_speed_penalty)
  end

  if way:get_value_by_key('natural') == 'tree' then
    quillamap_multiply_result(result, 'forward_speed', QUILLAMAP_THERMAL_COMFORT.tree_speed_bonus)
    quillamap_multiply_result(result, 'backward_speed', QUILLAMAP_THERMAL_COMFORT.tree_speed_bonus)
  elseif way:get_value_by_key('leisure') == 'park' then
    quillamap_multiply_result(result, 'forward_speed', QUILLAMAP_THERMAL_COMFORT.park_speed_bonus)
    quillamap_multiply_result(result, 'backward_speed', QUILLAMAP_THERMAL_COMFORT.park_speed_bonus)
  end
end
