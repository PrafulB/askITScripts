import axios from 'axios'

const dialogFlowAPIBasePath = 'https://api.dialogflow.com/v1'
const intentsEndpoint = '/intents'
const versioningParam = '?v=20170712'
const DEVELOPER_ACCESS_TOKEN = '4e911d4bfbce43dbbc7cda08bcead4c8'

axios({
    method: 'get',
    url: dialogFlowAPIBasePath + intentsEndpoint + versioningParam,
    headers: {
      'Authorization': 'Bearer ' + DEVELOPER_ACCESS_TOKEN
    }
  })
  .then((resp) => {
    resp.data.map((intent) => {
      if(intent.name.indexOf('Default') == -1){
        axios({
            method: 'delete',
            url: dialogFlowAPIBasePath + intentsEndpoint + '/' + intent.id + versioningParam,
            headers: {
              'Authorization': 'Bearer ' + DEVELOPER_ACCESS_TOKEN
            }
        })
        .catch((err) => {
            console.log(err)
        })
      }
    })
  })
  .catch((err) => {
    console.log(err.response.data)
  })