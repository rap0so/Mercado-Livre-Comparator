process.setMaxListeners(0);

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const pup = require('puppeteer');

const ourProducts = require('../products');

const csvWriter = createCsvWriter({
  path: 'result.csv',
  header: [
    {
      id: 'ourProductName',
      title: 'Nome nosso produto',
    },
    { id: 'ourPrice', title: 'Nosso Preço' },
    {
      id: 'theirPrice',
      title: 'Preço Concorrencia (top 5)',
    },
    { id: 'average', title: 'Estamos na média?' },
  ],
});

const crawler = async name => {
  const browser = await pup.launch();
  const page = await browser.newPage();

  await page.goto('https://mercadolivre.com.br/');

  await page.type('.nav-search-input', name);

  await page.click('.nav-search-btn');

  await page.waitForSelector('.results-item');

  const results = await page.evaluate(() => {
    const parseElementToObject = product => {
      const price = product.querySelector('.item__price').innerText;
      const parsedPrice = price
        .replace(/R\$/g, '')
        .trim()
        .replace(/\s/g, ',')
        .replace(/\./, '');

      const numberedPrice = parsedPrice.includes(',')
        ? parsedPrice.replace(',', '.')
        : `${parsedPrice}.00`;

      return {
        name: product.querySelector('.main-title').innerText,
        price,
        priceNum: Number(numberedPrice),
      };
    };

    const firstFiveProducts = Array.from(
      document.querySelectorAll('.results-item')
    ).slice(0, 5);
    const parsedProduct = firstFiveProducts.map(parseElementToObject);

    return parsedProduct;
  });

  await browser.close();

  return results;
};

const getAverageText = (product, crawledProducts) => {
  const average =
    crawledProducts.reduce(
      (acc, current) => acc + current.priceNum,
      0
    ) / crawledProducts.length;

  const roundedAverage = Math.round(average);

  console.log('roundedAverage', roundedAverage);
  console.log('priceNum', product.priceNum);

  const numberedPrice = product.priceNum / 100;

  const averagePreFix =
    numberedPrice === roundedAverage
      ? 'Está na media'
      : numberedPrice > roundedAverage
      ? 'Acima da média'
      : 'Abaixo da média';

  const averageText = `${averagePreFix} que é de R$ ${Number(
    roundedAverage
  ).toFixed(2)}`;

  return averageText;
};

const main = async () => {
  console.log('Iniciando ...');

  console.log('Crawleando produtos ...');
  const mappedResult = ourProducts.map(async product => {
    const productName = product.name;
    const crawledProducts = await crawler(productName);

    console.log(`Comparando produto ${productName}`);
    const averageText = getAverageText(product, crawledProducts);

    return {
      average: averageText,
      ourProductName: productName,
      ourPrice: product.preco,
      theirPrice: crawledProducts
        .map(cProduct => cProduct.price)
        .join(', '),
    };
  });

  const resultToCSV = await Promise.all(mappedResult);

  console.log('Iniciando escrita');
  console.log(resultToCSV);

  await csvWriter.writeRecords(resultToCSV);
  return console.log('Processo completo');
};

try {
  main();
} catch (error) {
  console.log(error);
}
