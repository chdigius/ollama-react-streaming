import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [model, setModel] = useState('dolphin-mistral:latest')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [showDebug, setShowDebug] = useState(false)
  const [debugLogs, setDebugLogs] = useState([])
  const messagesEndRef = useRef(null)
  const debugEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (showDebug && debugLogs.length > 0) {
      debugEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [debugLogs, showDebug])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setIsStreaming(true)

    // Add user message to chat
    const newUserMessage = { role: 'user', content: userMessage }
    setMessages(prev => [...prev, newUserMessage])

    // Add empty assistant message that we'll stream into
    const assistantMessageId = Date.now()
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantMessageId }])
    
    // Clear debug logs for new stream
    setDebugLogs([])

    try {
      // Build messages array for chat API (includes all previous messages + new user message)
      const chatMessages = [
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage }
      ]

      const apiUrl = `${ollamaUrl}/api/chat`
      console.log('Sending request to:', apiUrl)
      console.log('Model:', model)
      console.log('Messages:', chatMessages)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: chatMessages,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Ollama API error:', response.status, response.statusText, errorText)
        throw new Error(`Ollama error: ${response.status} ${response.statusText}. ${errorText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunkCount++
        const rawChunk = decoder.decode(value, { stream: true })
        
        // Log raw chunk
        setDebugLogs(prev => [...prev, {
          type: 'chunk',
          timestamp: Date.now(),
          data: rawChunk,
          chunkNumber: chunkCount
        }])

        buffer += rawChunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          
          try {
            const data = JSON.parse(line)
            
            // Log parsed JSON
            setDebugLogs(prev => [...prev, {
              type: 'parsed',
              timestamp: Date.now(),
              data: data,
              rawLine: line
            }])
            
            // Chat API uses 'message.content' instead of 'response'
            const token = data.message?.content || data.response || ''
            
            // Log extracted token
            if (token) {
              setDebugLogs(prev => [...prev, {
                type: 'token',
                timestamp: Date.now(),
                data: token,
                escaped: JSON.stringify(token)
              }])
              
              // Stream the token into the assistant message
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + token }
                  : msg
              ))
            }

            if (data.done) {
              setDebugLogs(prev => [...prev, {
                type: 'done',
                timestamp: Date.now(),
                data: 'Stream completed'
              }])
              break
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e, line)
            setDebugLogs(prev => [...prev, {
              type: 'error',
              timestamp: Date.now(),
              data: `Parse error: ${e.message}`,
              rawLine: line
            }])
          }
        }
      }
    } catch (error) {
      console.error('Error streaming from Ollama:', error)
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, content: msg.content + `\n\n[Error: ${error.message}]` }
          : msg
      ))
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setDebugLogs([])
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Ollama Streaming Demo</h1>
        <div className="controls">
          <input
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="Ollama URL"
            className="url-input"
          />
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model name"
            className="model-input"
          />
          <button onClick={clearChat} className="clear-btn">Clear</button>
          <button 
            onClick={() => setShowDebug(!showDebug)} 
            className={`debug-btn ${showDebug ? 'active' : ''}`}
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>
      </div>

      <div className="chat-container">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>Start a conversation with Ollama!</p>
              <p className="hint">Type a message and press Enter to stream responses</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
              <div className="message-content">
                {msg.content || (msg.role === 'assistant' && isStreaming ? '...' : '')}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {showDebug && (
          <div className="debug-panel">
            <div className="debug-header">
              <h3>Stream Debug Log</h3>
              <div className="debug-stats">
                {debugLogs.length > 0 && (
                  <span>
                    {debugLogs.filter(l => l.type === 'chunk').length} chunks, {' '}
                    {debugLogs.filter(l => l.type === 'parsed').length} parsed, {' '}
                    {debugLogs.filter(l => l.type === 'token').length} tokens
                  </span>
                )}
              </div>
            </div>
            <div className="debug-content">
              {debugLogs.length === 0 ? (
                <div className="debug-empty">No stream data yet. Send a message to see debug logs.</div>
              ) : (
                debugLogs.map((log, idx) => (
                  <div key={idx} className={`debug-entry debug-${log.type}`}>
                    <div className="debug-entry-header">
                      <span className="debug-type">{log.type.toUpperCase()}</span>
                      <span className="debug-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.type === 'chunk' && (
                      <div className="debug-data">
                        <div className="debug-label">Raw Chunk #{log.chunkNumber}:</div>
                        <pre className="debug-pre">{JSON.stringify(log.data)}</pre>
                      </div>
                    )}
                    {log.type === 'parsed' && (
                      <div className="debug-data">
                        <div className="debug-label">Parsed JSON:</div>
                        <pre className="debug-pre">{JSON.stringify(log.data, null, 2)}</pre>
                        {log.rawLine && (
                          <>
                            <div className="debug-label">Raw Line:</div>
                            <pre className="debug-pre">{log.rawLine}</pre>
                          </>
                        )}
                      </div>
                    )}
                    {log.type === 'token' && (
                      <div className="debug-data">
                        <div className="debug-label">Extracted Token:</div>
                        <div className="debug-token-content">{log.data}</div>
                        <div className="debug-label">Escaped:</div>
                        <pre className="debug-pre">{log.escaped}</pre>
                      </div>
                    )}
                    {log.type === 'done' && (
                      <div className="debug-data">
                        <div className="debug-done">✓ {log.data}</div>
                      </div>
                    )}
                    {log.type === 'error' && (
                      <div className="debug-data">
                        <div className="debug-error">✗ {log.data}</div>
                        {log.rawLine && (
                          <>
                            <div className="debug-label">Raw Line:</div>
                            <pre className="debug-pre">{log.rawLine}</pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={debugEndRef} />
            </div>
          </div>
        )}

        <div className="input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="message-input"
            rows={3}
            disabled={isStreaming}
          />
          <button 
            onClick={sendMessage} 
            disabled={!input.trim() || isStreaming}
            className="send-btn"
          >
            {isStreaming ? 'Streaming...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
