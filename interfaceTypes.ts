export interface Suggestion {
    key: string,
    label: string,
    next: string,
    root: string,
    endpoint: boolean
}

export interface Context {
    lifespan: number,
    name: string
}

export interface Message {
    speech: string[],
    type: number
}

export interface CustomMessage {
    payload: {
        dataType: string,
        data: any
    },
    type: number
}

export interface Utterance {
    data: {
        text: string
    }[]
}

export interface ArticleLink {
    title: string,
    content: string,
    contentURL: string
}

export interface Article {
    serviceName: string,
    description: string,
    keywords: string,
    solution: string,
    solutionUrl: string
}

export interface Intent {
    auto: boolean,
    contexts: string[],
    name: string,
    responses: {
        affectedContexts: Context[],
        messages: Message[],
        resetContexts: boolean
    }[],
    userSays: Utterance[],
    webhookUsed: boolean
}
