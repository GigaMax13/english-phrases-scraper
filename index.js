const axios = require("axios");
const cheerio = require("cheerio");
const fs = require('fs');
const path = require('path');

const json = {
  categories: {},
};
let scrapedPhrases = 0;
let downloadedFiles = 0;

function sanitizeText(text) {
  if (!text || (text.constructor !== String || !String(text))) {
    return text;
  }

  return text.replace(/[\n\t]/g, '').replace(/\s\s+/g, ' ').trim();
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function download (url, name) {
  return new Promise(((resolve, reject) => {
    setTimeout(async () => {
      const filePath = path.resolve(__dirname, 'audios', name);
      const writer = fs.createWriteStream(filePath);

      try {
        const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream',
        });

        response.data.pipe(writer);

        writer.on('finish', resolve);
        writer.on('error', reject);
      } catch ({ config: { url } }) {
        console.log('Download File Error!');
        console.log(url);
        await fs.unlinkSync(filePath);
      }
    }, randomIntFromInterval(2e3, 500));
  }));
}

function scrapingPage(category) {
  return axios
    .get(`http://www.englishspeak.com/pt/english-phrases?category_key=${category}`)
    .then(({ data }) => {
      const $ = cheerio.load(data);

      const categoryName = $(`.panel-body ol li:nth-of-type(${category}) a`).text();
      const numOfPhrases = $('table tbody tr').length;

      const categoryData = [];

      for(let i = 1; i <= numOfPhrases; i++) {
        if ($(`table tbody tr:nth-of-type(${i}) td`).length < 3) {
          continue;
        }

        scrapedPhrases += 1;

        const englishParagraphTag = $(`table tbody tr:nth-of-type(${i}) td:nth-of-type(1) p`);
        const english = sanitizeText(englishParagraphTag.text());

        englishParagraphTag.remove();

        const portugues = sanitizeText($(`table tbody tr:nth-of-type(${i}) td:nth-of-type(1)`).text());
        const audioUrl = $(`table tbody tr:nth-of-type(${i}) td:nth-of-type(3) img`).attr('onclick').replace(/(.+\(')(.+)('\))$/, '$2');
        const audio = audioUrl.replace(/(.+\/)((?=\w+\.\w{3,4}$).+)/, '$2');

        download(audioUrl, audio)
          .then(() => {
            downloadedFiles += 1;
          });

        categoryData.push({
          english,
          portugues,
          audio,
        });
      }

      json.categories = {
        ...json.categories,
        [categoryName]: categoryData,
      }
    });
}

function scraper(category = 1, numOfCategories = 19) {
  console.log(`Scraping category ${category}`);

  scrapingPage(category)
    .then(async () => {
      if (category < numOfCategories) {
        scraper(category + 1, numOfCategories);
      } else {
        const filePath = path.resolve(__dirname, 'english-phrases.json');
        await fs.writeFileSync(filePath, JSON.stringify(json));

        setTimeout(() => {
          console.log({
            scrapedPhrases,
            downloadedFiles,
          });
          process.exit();
        }, 3e3);
      }
    })
    .catch((e) => {
      console.log('Download Page Error!');
      console.trace(e);
    });
}

scraper();
