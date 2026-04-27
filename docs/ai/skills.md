# 🛠️ Backend Skills - QuillaMap

## Core Skills
- **[CS-01] Profile Management:** Capacidad para crear, leer y actualizar perfiles de usuario vinculados a Supabase Auth, incluyendo lógica de Karma y validación de placas de vehículos.
- **[CS-02] Geospatial Intelligence:** Capacidad para realizar buffers espaciales y detectar si un punto de usuario intersecta con una zona de riesgo (arroyos/baches).
- **[CS-03] Modular Scale:** Implementación de módulos independientes (`Profiles`, `Alerts`, `Navigation`) que se comunican de forma limpia.

## Technical Standards
- **[TS-01] Validation Contract:** Sincronización bidireccional de tipos entre Zod y TypeScript.
- **[TS-02] Absolute Pathing:** Uso estricto de alias `@/` para evitar "Import Hell".
- **[TS-03] Resource Efficiency:** Código optimizado para baja latencia y consumo mínimo de memoria (Survival Mode).