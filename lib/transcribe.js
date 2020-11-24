const speech = require('@google-cloud/speech');
const {Storage} = require('@google-cloud/storage');
const {GoogleAuth, grpc} = require('google-gax');
const path = require('path');
const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const extractSpeech = async (filepath, txtPath) => {

    const apiKey = 'AIzaSyD1mmcYpA_9kPGaU-gAXn8XbTbTYqvGMqE';

    function getApiKeyCredentials() {
      const sslCreds = grpc.credentials.createSsl();
      const googleAuth = new GoogleAuth();
      const authClient = googleAuth.fromAPIKey(apiKey);
      const credentials = grpc.credentials.combineChannelCredentials(
        sslCreds,
        grpc.credentials.createFromGoogleCredential(authClient)
      );
      return credentials;
    }

    const sslCreds = getApiKeyCredentials();
    const client = new speech.SpeechClient({sslCreds});

      // Google Cloud storage
    const bucketName = 'dailypress-stt'; // Must exist in your Cloud Storage

    const uploadToGcs = async () => {
        const storage = new Storage({
            keyFilename: "./key.json"
        });

        const bucket = storage.bucket(bucketName);
        const fileName = path.basename(filepath);

        await bucket.upload(filepath);

        return `gs://${bucketName}/${fileName}`;
    };

    const gcsUri = await uploadToGcs();

    const audio = {
        uri: gcsUri,
    };

    const config = {
        enableWordTimeOffsets: true,
        encoding: 'Lavf55.18.100',
        sampleRateHertz: 16000,
        languageCode: 'it-IT',
    };

    const request = {
        audio: audio,
        config: config,
    };

    let wordsInfo = '[\n';

    const [operation] = await client.longRunningRecognize(request);
    // Get a Promise representation of the final result of the job
    const [response] = await operation.promise();

    response.results.forEach(async result => {
        result.alternatives[0].words.forEach(async wordInfo => {

          const startSecs =
            `${wordInfo.startTime.seconds}` +
            '.' +
            wordInfo.startTime.nanos / 100000000;
          const endSecs =
            `${wordInfo.endTime.seconds}` +
            '.' +
            wordInfo.endTime.nanos / 100000000;

          wordsInfo = wordsInfo.concat(`{\n"Word":"`, wordInfo.word, `",\n"startTime":`, startSecs, `,\n"endTime":`, endSecs, `\n},\n`);
        });
    });
    wordsInfo = wordsInfo.concat(']');

    const writeFilePromisified = util.promisify(fs.writeFile);
    await writeFilePromisified(txtPath, wordsInfo);

};

module.exports = {extractSpeech};