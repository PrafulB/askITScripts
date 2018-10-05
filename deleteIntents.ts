import axios from 'axios'
import * as limit from 'simple-rate-limiter'

const dialogFlowAPIBasePath = 'https://api.dialogflow.com/v1'
const intentsEndpoint = '/intents'
const versioningParam = '?v=20170712'
const DEVELOPER_ACCESS_TOKEN = process.argv[2] === 'prod' ? '249f1ae954f0421ab2b3e84979d066fa' : '4e911d4bfbce43dbbc7cda08bcead4c8'
const intentsToDeletePerCall = 50;

axios({
    method: 'get',
    url: dialogFlowAPIBasePath + intentsEndpoint + versioningParam,
    headers: {
      'Authorization': 'Bearer ' + DEVELOPER_ACCESS_TOKEN
    }
  })
  .then((resp) => {
    console.log(`Starting deletion of ${resp.data.length} intents`)
    deleteIntents(resp.data);
  })
  .catch((err) => {
    console.log(err.response.data)
  })

function deleteIntents(intents: any) {
  const deleteIntentFromDialogflow = limit((intentId, index) => {
    axios({
      method: 'delete',
      url: dialogFlowAPIBasePath + intentsEndpoint + '/' + intentId + versioningParam,
      headers: {
        'Authorization': 'Bearer ' + DEVELOPER_ACCESS_TOKEN
      }
    })
    .then(() => {
      console.log(`Deleted intent ${index}`);
    })
    .catch((err) => {
        console.log(err.response.status, err.response.statusText)
    })
  }).to(45).per(1000*60)


  intents.forEach((intent, index) => {
    if(!intent.name.includes('Default')) {
      deleteIntentFromDialogflow(intent.id, index)
    }
  })

  // const intents2DList = _.chunk(intents, intentsToDeletePerCall)
  
  // await intents2DList.forEach((intentsList, index) => {
  //   setTimeout(async (intentsList, index) => {
  //     console.log(`Deleting Intents of sublist ${index}`)
  
  //     await intentsList.forEach(async (intent, intentIndex) => {
  
  //       if(intent.name.indexOf('Default') == -1){
  //         
  //       }
  //     })
  //   }, index*30000, intentsList, index)
  // })
}