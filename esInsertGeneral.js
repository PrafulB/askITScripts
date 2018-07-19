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

const client = new es.Client({
  host: '18.222.55.46:9200',
  log: 'warning',
});

function createBulk(results, servicesMapping) {
  const body = [];
  results.forEach((item) => {
    body.push({
      index: {
        _index: INDEX_NAME,
        _type: TYPE_NAME,
        _id: item.kb_id,
      },
    });
    body.push({
      serviceId: parseInt(servicesMapping[item.UniversityService], 10),
      serviceName: item.UniversityService,
      description: unescape(item.short_description) || '',
      serviceTower: item.service_tower || '',
      keywords: unescape(item.keywords) || '',
      solution: unescape(item.solution) || '',
      solutionUrl: unescape(item.url) || '',
    });

    // console.log(typeof (body[body.length - 1].service));
  });
  return body;
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
    return client.bulk({ body });
  })
  .then((respOfBulk) => {
    console.log('Bulk Insert', respOfBulk.items.length);
  })
  .catch((err) => {
    console.log('ERROR OCCURRED!', err);
  });
