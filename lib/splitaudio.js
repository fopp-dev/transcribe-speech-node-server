const ffmpeg = require('fluent-ffmpeg');

const splitAudio = async (input, output) => {

    return new Promise((resolve, reject) => {
        ffmpeg(input)
            .output(output)
            .format('mp3')
            .outputOptions('-ar','16000')
            .on('end', () => {
                resolve("conversion ended");
             })
            .on('error', (err) => {
                reject(err);
             }).run();
    });
};

const getVideoInfo = (inputPath) => {
    return new Promise((resolve, reject) => {
        return ffmpeg.ffprobe(inputPath, (error, videoInfo) => {
            if (error) {
                return reject(error);
            }

            const { duration } = videoInfo.format;

            return resolve({
                duration: duration,
            });
        });
    });
};

module.exports = {splitAudio, getVideoInfo};

