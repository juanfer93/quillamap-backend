
const { Client } = require('pg');

async function testConnection(connectionUrl, port) {
  console.log(`\n--- PROBANDO PUERTO ${port} ---`);
  const client = new Client({ connectionString: connectionUrl });
  try {
    await client.connect();
    console.log(`✅ ÉXITO: La conexión al puerto ${port} fue exitosa.`);
    const res = await client.query('SELECT 1 as test');
    console.log(`   Resultado de la consulta: ${res.rows[0].test}`);
  } catch (err) {
    console.error(`❌ FALLÓ: La conexión al puerto ${port} falló.`);
    console.error(`   Mensaje: ${err.message}`);
  } finally {
    await client.end();
    console.log(`--- PRUEBA PARA EL PUERTO ${port} FINALIZADA ---\n`);
  }
}

async function runTests() {
  const urlConPuerto5432 = "postgresql://postgres.wwvulttpqdemfznxjocu:Jfpi0793hotmail@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
  const urlConPuerto6543 = "postgresql://postgres.wwvulttpqdemfznxjocu:Jfpi0793hotmail@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

  console.log("Iniciando pruebas de conexión a la base de datos...");

  await testConnection(urlConPuerto5432, 5432);
  await testConnection(urlConPuerto6543, 6543);

  console.log("Pruebas de conexión finalizadas.");
}

runTests();
