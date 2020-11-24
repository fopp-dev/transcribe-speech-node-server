const pg = require('pg');


var config = {
  user: 'postgres', 
  database: 'test',
  password: '123', 
  host: 'localhost', 
  port: 5432, 
  // max: 10,
  // idleTimeoutMillis: 30000 
}

const pool = new pg.Pool(config);

const query = async (q, v) => {
  const client = await pool.connect();
  let res;
  try {
    await client.query('BEGIN');
    try {
      res = await client.query(q, v);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
  return res;
}

const save = async (id, txtpath, audiopath, videopath) => {

  try {
    const queryString = `INSERT INTO info(
        id, txtpath, audiopath, videopath
        ) VALUES(
        $1, $2, $3, $4)`;
    await query(queryString, [id, txtpath, audiopath, videopath]);

  } catch (err) {
    // console.log('Database ' + err);
    throw err;
  }

};

const update = async (id, status, msg) => {
  try {
    const queryString = `UPDATE info SET status = $1, msg = $2 where id = $3`;
    await query(queryString, [status, msg, id]);

  } catch (err) {
    // console.log('Database ' + err);
    throw err;
  }

};

module.exports = {save, update};