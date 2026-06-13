-- =============================================================================
-- SCHEMA: diario.propi → Supabase
-- Proyecto: lpulmjzboogixbdxxayo
-- Ejecutar UNA SOLA VEZ en:
-- https://supabase.com/dashboard/project/lpulmjzboogixbdxxayo/sql
-- =============================================================================

-- 1. Recaudaciones diarias
CREATE TABLE IF NOT EXISTS recaudaciones (
    id      TEXT PRIMARY KEY,
    fecha   DATE NOT NULL,
    tipo    TEXT NOT NULL DEFAULT 'Sin Tipo',
    monto   NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 2. Divisores (un valor por fecha)
CREATE TABLE IF NOT EXISTS divisores (
    id      TEXT PRIMARY KEY,
    fecha   DATE NOT NULL UNIQUE,
    valor   NUMERIC(10,4) NOT NULL
);

-- 3. Saldo del fondo (fila única con id='main')
CREATE TABLE IF NOT EXISTS saldo_fondo (
    id      TEXT PRIMARY KEY,
    fecha   DATE,
    monto   NUMERIC(12,2)
);

-- 4. Notas de recaudación
CREATE TABLE IF NOT EXISTS notas_recaudacion (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    autor       TEXT NOT NULL DEFAULT 'Sistema',
    mensaje     TEXT NOT NULL
);

-- 5. Períodos archivados
CREATE TABLE IF NOT EXISTS periodos_archivados_rec (
    id           TEXT PRIMARY KEY,
    nombre       TEXT NOT NULL UNIQUE,
    fecha_inicio DATE,
    fecha_fin    DATE,
    total_rec    NUMERIC(12,2),
    datos        JSONB
);

-- Habilitar Row Level Security en todas las tablas
ALTER TABLE recaudaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldo_fondo             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_recaudacion       ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos_archivados_rec ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso completo para anon
-- (la autenticación la maneja la propia app)
CREATE POLICY "anon_all_recaudaciones"
    ON recaudaciones FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_divisores"
    ON divisores FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_saldo_fondo"
    ON saldo_fondo FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_notas_recaudacion"
    ON notas_recaudacion FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_periodos_archivados_rec"
    ON periodos_archivados_rec FOR ALL TO anon USING (true) WITH CHECK (true);
