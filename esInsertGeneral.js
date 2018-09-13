const request = require('axios');
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const es = require('elasticsearch');
const hash = require('string-hash');

const INDEX_NAME = 'askit';
const TYPE_NAME = 'kb';
const univService = '';
const apiPath = 'https://nyudev.service-now.com/api/neyu/knowledge_for_bot/articles?univ_service=';

const ES_USERNAME = 'es4askit'
const ES_PASSWORD = 'codyGo4'
const ES_HOST = [{
  host: '18.216.253.76',
  port: 80,
  auth: ES_USERNAME + ':' + ES_PASSWORD
}]
const client = new es.Client({
  host: ES_HOST,
  log: 'warning',
});
const ES_BULK_LIMIT = 100;

function createBulk(results, servicesMapping) {
  const bulksList = [];
  results.forEach((item, index) => {
    if (index % ES_BULK_LIMIT === 0) {
      bulksList[bulksList.length] = [];
    }
    bulksList[bulksList.length - 1].push({
      index: {
        _index: INDEX_NAME,
        _type: TYPE_NAME,
        _id: item.kb_id,
      },
    });
    bulksList[bulksList.length - 1].push({
      serviceId: parseInt(servicesMapping[item.UniversityService], 10),
      serviceName: item.UniversityService,
      description: unescape(item.short_description) || '',
      serviceTower: item.service_tower || '',
      keywords: unescape(item.keywords) || '',
      solution: unescape(item.solution) || '',
      solutionUrl: unescape(item.url) || '',
    });

    // console.log(typeof (bulksList[bulksList.length - 1].service));
  });
  return bulksList;
}

function makeESRequests(bulksList) {
  const esInsertRequests = [];
  bulksList.forEach((body) => {
    esInsertRequests.push(client.bulk({ body }));
  })
  return Promise.all(esInsertRequests);
}

client.ping({
  requestTimeout: 1000,
})
  .then(() => request.get(apiPath + univService, {
    auth: {
      username: 'tst710',
      password: 'tst710',
    },
  }), (error) => {
    console.trace(error.message);
  })
  .then((resp) => {
    // console.log(_.uniq(_.map(resp.data.results, 'service_tower')));
    const uniqueServices = _.uniq(_.map(resp.data.results, 'UniversityService'));
    const uniqueServiceIds = _.map(uniqueServices, service => hash(service.trim()));
    const uniqueServicesObj = _.zipObject(uniqueServices, uniqueServiceIds);

    fs.writeFile(path.join(__dirname, 'serviceToIdMapping.json'), JSON.stringify(uniqueServicesObj));

    const body = createBulk(resp.data.results, uniqueServicesObj);
    return makeESRequests(body);
  })
  .then((respOfBulk) => {
    console.log('Bulk Insert');
  })
  .catch((err) => {
    console.log('ERROR OCCURRED!', err);
  });
