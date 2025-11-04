# Ollama React Streaming Demo

A minimal React app demonstrating real-time token streaming from [Ollama](https://ollama.ai)'s local LLM API. Built to understand how Ollama's `/api/chat` endpoint works and debug streaming implementations.

## Features

- **Direct Ollama Integration** — React frontend talks directly to Ollama's API (no backend proxy)
- **Real-Time Token Streaming** — Uses `fetch()` with `response.body.getReader()` to stream tokens as they generate
- **Debug Panel** — Shows raw chunks, parsed JSON, and extracted tokens to inspect the stream in detail
- **Chat Interface** — Clean UI with message history and auto-scroll
- **Configurable** — Change model and Ollama URL on the fly

## Why This Exists

This project was created to isolate and debug streaming issues in a more complex AI framework. By stripping away backend layers and middleware, it demonstrates the "simplest thing that works" for Ollama streaming.

The debug panel is especially useful for:
- Understanding Ollama's streaming response format
- Verifying that formatting (newlines, code blocks, etc.) is preserved
- Debugging why tokens might not appear correctly in your own app

## Prerequisites

- [Ollama](https://ollama.ai) installed and running locally
- Node.js 18+ and npm

## Setup

1. **Start Ollama:**
   ```bash
   ollama serve
   ```

2. **Pull a model** (if you haven't already):
   ```bash
   ollama pull llama3.2
   # or
   ollama pull dolphin-mistral
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the dev server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Navigate to `http://localhost:5173` (or whatever port Vite shows)

## Usage

1. Enter a message in the input field and press Enter (or click Send)
2. Watch tokens stream in real-time as Ollama generates the response
3. Click **Show Debug** to see:
   - Raw chunks received from Ollama
   - Parsed JSON objects
   - Extracted tokens
   - Stream statistics

## How It Works

The app uses raw `fetch()` streaming (not SSE/EventSource) to read Ollama's response:

```javascript
const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  
  for (const line of lines) {
    const data = JSON.parse(line)
    const token = data.message?.content || ''
    // Append token to UI
  }
}
```

Ollama sends JSON objects separated by newlines:
```json
{"message":{"role":"assistant","content":"Hello"},"done":false}
{"message":{"role":"assistant","content":" world"},"done":false}
{"message":{"role":"assistant","content":"!"},"done":true}
```

Each `message.content` field contains a token that we append to the assistant's message in real time.

## Tech Stack

- **React 19** — UI framework
- **Vite** — Build tool and dev server
- **Ollama API** — Local LLM inference

## Project Structure

```
ollama-react-streaming/
├── src/
│   ├── App.jsx          # Main component with chat + streaming logic
│   ├── App.css          # Styles for chat UI and debug panel
│   ├── index.css        # Global styles
│   └── main.jsx         # React entry point
├── package.json
└── README.md
```

## Configuration

You can change the model and Ollama URL directly in the UI:

- **Ollama URL:** Default is `http://localhost:11434`
- **Model:** Default is `dolphin-mistral:latest` (change to any model you have pulled)

## Debug Panel Details

The debug panel logs four types of events:

- **CHUNK** — Raw bytes received from Ollama (may contain partial JSON)
- **PARSED** — Successfully parsed JSON objects
- **TOKEN** — Extracted tokens that are appended to the UI
- **DONE** — Stream completion marker

This helps you understand exactly what Ollama sends and how it's parsed.

## License

MIT

## Contributing

This is a minimal demo, but PRs for improvements are welcome!

## Acknowledgments

Built to debug streaming in [LifewareCore.ai](https://github.com/yourusername/lifewarecore) — a local-first AI assistant framework.
