import axios from 'axios'
import * as es from 'elasticsearch'
import * as limit from 'simple-rate-limiter'

import {
  Suggestion,
  Intent,
  Utterance,
  Message,
  CustomMessage,
  Context,
  ArticleLink
} from './interfaceTypes'

const ES_USERNAME = 'es4askit'
const ES_PASSWORD = 'codyGo4'
const ES_HOST = [{
  host: '18.216.253.76',
  port: '80',
  auth: ES_USERNAME + ':' + ES_PASSWORD
}]
const ARTICLE_INDEX_NAME = 'askit'
const ARTICLE_TYPE_NAME = 'kb'
const SUGGESTIONS_INDEX_NAME = 'suggestions'
const SUGGESTIONS_TYPE_NAME = '_doc'
const INITIAL_SUGGESTIONS_LIST: Suggestion = {
  key: '',
  label: '',
  next: '0',
  root: '',
  endpoint: false
}

const INTENTS_TO_CREATE_PER_BATCH = 45
const MINUTE = 1000*60
const dialogFlowAPIBasePath = 'https://api.dialogflow.com/v1'
const intentsEndpoint = '/intents'
const versioningParam = "?v=20170712"
const DEVELOPER_ACCESS_TOKEN = process.argv[2] === 'prod' ? '249f1ae954f0421ab2b3e84979d066fa' : '4e911d4bfbce43dbbc7cda08bcead4c8'

const utterancePrefixPhrases = [
  '',
  'I need help with ',
  'I have a query regarding '
]
const suggestionResponses = [
  'Noted. Could you be a tad more specific by choosing one of the options below?',
  'Okay, does any of the following options relate to your query?',
  'Alright! I need a little more information to solve your query. Could you select one of the options from the list below?'
]
const articleResponses = [
  "Okay, here's what I found:",
  "Here's an article that might address your query:"
]
const linkListResponses = [
  "Here's a selection of articles related to your question:",
  "Check out these articles I found that might help you:",
  "I think these articles might help you out:"
]
const satisfactionResponsesArticle = [
  "Did it help solve your query?",
  "Was the article helpful?",
  "Does the article help resolve your question?"
]
const satisfactionResponsesLinkList = [
  "Did any of these articles help resolve your query?",
  "Were any of these articles helpful?",
  "Did you find the answer to your question in any of these articles?"
]
const satisfactionSuggestions = [{
    "suggestion": "Yes"
  },{
    "suggestion": "No"
}]
const intakeResponses = [
  "Would you like to try again, or do you want to create a ticket with the NYU ServiceDesk regarding this?",
  "Do you want me to try again, or should I create a ticket for you with the NYU ServiceDesk?"
]
const intakeSuggestions = [{
  "suggestion": "Retry"
  },{
  "suggestion": "Create Ticket"
  },{
  "suggestion": "Nah, leave it"
}]
const feedbackResponses = [[
  "I hope I was able to help you out today!",
  "Would you like to provide some feedback about your experience?"
], [
  "I try my best to be as helpful as I can.",
  "Your feedback would help me grow better! Would you mind sharing how your experience was today?"
], [
  "I'd love to know how your experience was today!",
  "Would you like to share some comments about your experience today?"
]]
const feedbackSuggestions = [{
    "suggestion": "Sure!"
  },{
    "suggestion": "Not right now"
}]

const customContexts = {
  "satisfaction": {
    "lifespan": 1,
    "name": "satisfaction"
  },
  "intake": {
    "lifespan": 1,
    "name": "create_intake"
  },
  "feedback": {
    "lifespan": 1,
    "name": "feedback"
  }
}

let insertedCount = 0

axios.interceptors.request.use(request => {
  // console.log('\nBody:\n', JSON.stringify(request.data))
  return request
})

// Remove non-alphanumeric symbols from string (since Dialogflow does not accept them) and
// replace whitespaces with underscore (required for context names).
function removeSpecialChars(str: string, escapeSpaces: boolean): string {
  try {
    str = require('emoji-strip')(str)
    str = str.replace(/[^\w\s]/gi, ' ').trim()
    if (escapeSpaces) {
      str = str.replace(/ /g, "_")
    }
  } catch {
    console.log(str)
  }
  return str
}

function formatTitle(str: string): string {
  try {
    return unescape(str.split(':')[1].trim())
  } catch(err) {
    return str
  }
}

// Add the standard utterance prefix phrases to the query (most often the suggestion) and
// return an array of complete sentences as the training text for Dialogflow.
function generateUtteranceSentences(query: string): Array < Utterance > {
  return utterancePrefixPhrases.map((phrase) => {
    return {
      "data": [{
        "text": phrase + removeSpecialChars(query, false)
      }]
    }
  })
}

// Instantiates and returns an Elasticsearch client object.
function instantiateElasticsearch(host: object): es.Client {
  let x: es.Client
  try {
    x = new es.Client({
      host
    })
  } catch (err) {
    console.log(err)
  }
  return x
}
// Get data from Elasticsearch corresponding to the suggestion ID passed.
async function getDataFromES(suggestion: Suggestion): Promise < any > {
  let response: es.GetResponse < {} >
  const clusterUp = await esClient.ping({
    // ping usually has a 3000ms timeout
    requestTimeout: 1000
  })
  
  if (!clusterUp) {
    console.trace('elasticsearch cluster is down!');
  } else {
    if (!suggestion.endpoint) {
      try {
        response = await esClient.get({
          index: SUGGESTIONS_INDEX_NAME,
          type: SUGGESTIONS_TYPE_NAME,
          id: suggestion.next
        })
      } catch (err) {
        console.log(suggestion)
      }
    } else {
      response = await esClient.get({
        index: ARTICLE_INDEX_NAME,
        type: ARTICLE_TYPE_NAME,
        id: suggestion.next
      })
    }
  
    return response._source
  }
}

// Call the Dialogflow Create Intent API with the generated intent.
async function createDialogflowIntent(intent: Intent ): Promise<void> {
  axios({
    method: 'post',
    url: dialogFlowAPIBasePath + intentsEndpoint + versioningParam,
    data: intent,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEVELOPER_ACCESS_TOKEN
    }
  })
  .then(() => console.log(`Inserted Intent ${++insertedCount}`))
  .catch((err) => {
    console.log(err.response.data)
  })
}

// Generate the output contexts that should be activated when the intent is invoked, which 
// should be similar to the suggestions selected up to this point.
function generateAffectedContexts(selectedSuggestions: Array < string > ): Array < Context > {
  // return selectedSuggestions.map((suggestion) => {
  //   return {
  //     "lifespan": 3,
  //     "name": suggestion
  //   }
  // })

  return [{
    "lifespan": 3,
    "name": selectedSuggestions[0]
  }]
}

// Generate the input -- textual or via suggestion selection -- that the user is expected to
// make that will activate the intent.
function generateUserUtterances(queries: Array < string > ): Array < Utterance > {
  let userSays = []
  queries.map((query) => {
    userSays = userSays.concat(generateUtteranceSentences(query))
  })
  return userSays
}

// Generate the list of suggestions to be shown to the user when the intent is invoked.
function generateBotResponses(suggestionList: Array < Suggestion > ): [CustomMessage, Message] {
  
  let botResponses: any = [{
      "speech": suggestionResponses,
      "type": 0
    } as Message
  ]
  botResponses.push({
    "platform": "slack",
    "speech": suggestionResponses,
    "type": 0
  })
  botResponses.push({
    "platform": "slack",
    "replies": suggestionList.slice(0, 9).map(suggestion => suggestion.label.substring(0,18)),
    "type": 2
  })

  const suggestionsToDisplay = suggestionList.map(suggestion => ({ "suggestion": suggestion.label }))

  botResponses.push({
      "payload": {
        "dataType": "suggestions",
        "data": suggestionsToDisplay
      },
      "type": 4
    } as CustomMessage)

  return botResponses
}

async function generateLinkList(linkSuggestions: Array< Suggestion >): Promise<[CustomMessage, Message]> {
  let botResponses: any = [{
      "speech": linkListResponses,
      "type": 0
    } as Message
  ]
  let linkList: ArticleLink[] = []

  for(const suggestion of linkSuggestions) {
    const { description, solution, solutionUrl } = await getDataFromES(suggestion)
    linkList.push({
      "title": formatTitle(description),
      "content": solution,
      "contentURL": solutionUrl
    })
  }
  
  botResponses.push({
    "payload": {
      "dataType": "linkList",
      "data": linkList
    },
    "type": 4
  } as CustomMessage)

  botResponses.push({
    "speech": satisfactionResponsesLinkList,
    "type": 0
  } as Message)

  botResponses.push({
    "payload": {
      "dataType": "suggestions",
      "data": satisfactionSuggestions
    },
    "type": 4
  } as CustomMessage)

  return botResponses
}

// Generate the intent to be added to Dialogflow on the basis of suggestion selection.
async function generateIntent(suggestion: Suggestion, selectedSuggestions: Array < string > , nextData: any): Promise< Intent[]> {

  let intentName = ''
  let affectedContexts: Context[]
  let userSays: Utterance[]
  let messages: any
  let intents: Intent[] = []
  let resetContexts: boolean = false

  if (!suggestion.endpoint) {
    intentName = selectedSuggestions.join("_") + "_" + suggestion.key
    userSays = generateUserUtterances([suggestion.key, suggestion.label])
    if(nextData.suggestions.every(nextLevelSuggestion => nextLevelSuggestion.endpoint === true)){
      // resetContexts = true
      affectedContexts = [customContexts['satisfaction']]
      messages = await generateLinkList(nextData.suggestions)
    }
    else {
      const outputContexts = selectedSuggestions.concat(removeSpecialChars(suggestion.key, true))
      affectedContexts = generateAffectedContexts(outputContexts)
      messages = generateBotResponses(nextData.suggestions)
      // resetContexts = false
    }
    if(selectedSuggestions.length > 0){
      const intentWithoutContext: Intent = {
        "auto": true,
        "contexts": [],
        "name": suggestion.key,
        "responses": [{
          affectedContexts,
          messages,
          resetContexts
        }],
        userSays,
        webhookUsed: false
      }
      intents.push(intentWithoutContext)
    }
  } else {
    affectedContexts = [customContexts['satisfaction']]
    // resetContexts = true
    const description = formatTitle(nextData.description)
    
    // TODO:
    // Use keyword n-grams calculated during suggestion list creation as additional user utterances input to Dialogflow.

    // The description is generally of the form "<description>: <headline>". The description is the
    // same for several articles, hence we discard it to generate the user utterance.
    userSays = [{
      "data": [{
        "text": description
      }]
    }]
    
    messages = [{
      "speech": articleResponses,
      "type": 0
    },{
      "platform": "slack",
      "speech": articleResponses,
      "type": 0
    },{
      "platform": "slack",
      "speech": JSON.stringify({
        "title": description,
        "content": nextData.solution,
        "contentURL": nextData.solutionUrl
      }),
      "type": 0
    }, {
      "payload": {
        "dataType": "article",
        "data": {
          "title": description,
          "content": nextData.solution,
          "contentURL": nextData.solutionUrl
        }
      },
      "type": 4
    }, {
      "speech": satisfactionResponsesArticle,
      "type": 0
    }, {
      "payload": {
        "dataType": "suggestions",
        "data": satisfactionSuggestions
      },
      "type": 4
    }]

    const intentWithoutContext: Intent = {
      "auto": true,
      "contexts": [],
      "name": description,
      "responses": [{
        affectedContexts,
        messages,
        resetContexts
      }],
      userSays,
      webhookUsed: true
    }
    intents.push(intentWithoutContext)
    
    intentName = selectedSuggestions.join("_") + "_" + description
    intentName = intentName.substring(0, 95)
  }
  
  intents.push({
    "auto": true,
    "contexts": [selectedSuggestions[0]],
    "name": intentName,
    "responses": [{
      affectedContexts,
      messages,
      resetContexts
    }],
    userSays,
    webhookUsed: suggestion.endpoint
  })
  return intents
}

async function recurseOverSuggestions(suggestion: Suggestion, suggestionsList: Array < string > ): Promise < Intent[] > {
  // For each suggestion, create a standalone Dialogflow intent and a contextual Dialogflow intent. Then get the 
  // next level suggestions for that suggestion (if not an endpoint) and similarly recurse.

  let allIntents = []
  const nextData = await getDataFromES(suggestion)
  const intents = await generateIntent(suggestion, suggestionsList, nextData)
  allIntents = allIntents.concat(intents)

  // await createDialogflowIntent(intents)
  if (!suggestion.endpoint) {
    const suggestionsListNew = suggestionsList.concat(removeSpecialChars(suggestion.key, true))
    for (let subSuggestion of nextData.suggestions) {
      const subIntents = await recurseOverSuggestions(subSuggestion, suggestionsListNew)
      allIntents = allIntents.concat(subIntents)
    }
  }
  return allIntents;
}

async function main() {
  //Get the first level suggestions from Elasticsearch and call recursor to get
  // the info of each of the suggestions.

  const initialSuggestionsList = await getDataFromES(INITIAL_SUGGESTIONS_LIST)
  let allIntents = []
  for (let suggestion of initialSuggestionsList.suggestions) {
    const intents = await recurseOverSuggestions(suggestion, [])
    allIntents = allIntents.concat(intents)
  }
  
  const createIntentInDialogflow = limit(createDialogflowIntent).to(INTENTS_TO_CREATE_PER_BATCH).per(MINUTE)
  allIntents.forEach((intent, index) => {
    createIntentInDialogflow(intent)
  })
  
}

const esClient = instantiateElasticsearch(ES_HOST)
main()