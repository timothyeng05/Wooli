import Groq from 'groq-sdk'

const apiKey = process.env.GROQ_API_KEY

let client: Groq | null = null

export function getGroq(): Groq {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set')
  }
  if (!client) {
    client = new Groq({ apiKey })
  }
  return client
}

export const GROQ_MODEL = 'llama-3.3-70b-versatile'
