const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');
const http = require('http');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const util = require('util');

const {splitAudio, getVideoInfo} = require('./lib/splitaudio');
const {extractSpeech} = require('./lib/transcribe');
const {save, update} = require('./lib/save');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(logger('dev'));
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));
app.use(cookieParser());
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileupload());


const router = express.Router();
const port = 3000;
const uploadPath = './public/upload/';

app.get("/local/:path", async (req, res, next) => {
  const filename = req.params.path;
  const path = uploadPath.concat(filename);
  console.log(path);

  await main(false, path, res);


});

app.get("/remote/:path", async (req, res, next) => {
  const path = req.params.path;

  await main(true, path, res);

});

const getFile = url => {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      const {statusCode} = response;
      if (statusCode === 200) {
        resolve(response);
      }
      reject(null);
    });
  });
};

async function main(isRemote, src, res){
  let id;
  const tmpPath = './transcription/temp/temp.mp4';
  const videoDir = './transcription/video/';
  const audioDir = './transcription/audio/';
  const textDir = './transcription/text/';

  try{
    const copyFilePromisified = util.promisify(fs.copyFile);
    const renameFilePromisified = util.promisify(fs.rename);
    if(!isRemote) {
      try{
        await copyFilePromisified(src, tmpPath);
      }
      catch(error){
        error.message = `Local File Copy Error: ${error.message}`;
        throw error;
      }
    }
    else {
      try{
        const file = fs.createWriteStream(tmpPath);
        const request = await getFile(src);
        request.pipe(file);
      }
      catch(error){
        error.message = `Remote File Copy Error: ${error.message}`;
        throw error;
      }
    }
    let duration;
    try{
      duration = await getVideoInfo(tmpPath);
    }
    catch(error){
      error.message = `Get Video Duration Error: ${error.message}`;
      throw error;
    }

    const timeStamp = (Date.now() + duration).toString();
    id = crypto.createHash('sha256').update(timeStamp).digest('hex').toString();
    const videoPath = videoDir.concat(id, '.mp4');
    const audioPath = audioDir.concat(id, '.mp3');
    const textPath = textDir.concat(id, '.txt');

    res.json({      
      status: 'start',
      processId: id
    });
    
    axios.post('https://hook.integromat.com/ms4a9r6kmvagywio9d48i313k4nlegc1', {
      status: 'start',
      processId: id
    });


    try{
      await renameFilePromisified(tmpPath, videoPath);
    }
    catch(error){
      error.message = `Rename File Error: ${error.message}`;
      throw error;
    }

    try{
      await splitAudio(videoPath, audioPath);
    }
    catch(error){
      error.message = `Split Audio Error: ${error.message}`;
      throw error;
    }

    try{
      await extractSpeech(audioPath, textPath);
    }
    catch(error){
      error.message = `Google Cloud Speech Error: ${error.message}`;
      throw error;
    }

    try{
      await save(id, textPath, audioPath, videoPath);
    }
    catch(error){
      error.message = `PostgreSql Error: ${error.message}`;
      throw error;
    }

    try{
      await update(id, "success", "");
    }
    catch(error){
      error.message = `PostgreSql Error: ${error.message}`;
      throw error;
    }

    axios.post('https://hook.integromat.com/ms4a9r6kmvagywio9d48i313k4nlegc1', {
      status: 'success',
      processId: id
    });

  }
  catch(err){
    try{
      await update(id, "fail", err.message);
    }
    catch(error){
    }
    console.log(err.message);

    axios.post('https://hook.integromat.com/ms4a9r6kmvagywio9d48i313k4nlegc1', {
      status: 'fail',
      processId: id,
      errors: err.message
    });
  }
}
// main(false, 'e:/13216451.mp4');

var server = app.listen(port, () => {
  console.log(`App running on port ${port}.`)
})

server.timeout = 600000;

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});



module.exports = app;