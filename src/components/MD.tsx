import ReactMarkdown from 'react-markdown'

// Simple markdown wrapper that takes a template literal string
export function MD(content: string): JSX.Element {
  // Remove leading indentation from multiline strings
  const lines = content.split('\n')
  const minIndent = lines
    .filter(line => line.trim().length > 0)
    .reduce((min, line) => {
      const match = line.match(/^(\s*)/)
      const indent = match ? match[1].length : 0
      return Math.min(min, indent)
    }, Infinity)

  const dedented = lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim()

  return (
    <ReactMarkdown
      components={{
        // Custom link rendering to handle footnotes
        a: ({ href, children }) => {
          // Check if it's an internal link (starts with #)
          if (href?.startsWith('#')) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault()
                  const element = document.querySelector(href)
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {children}
              </a>
            )
          }
          // External links open in new tab
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          )
        },
        // Style lists to match the existing design
        ul: ({ children }) => (
          <ul style={{ margin: 0, paddingLeft: '25px', lineHeight: 1.5 }}>
            {children}
          </ul>
        ),
        li: ({ children }) => (
          <li style={{ margin: '4px 0' }}>
            {children}
          </li>
        ),
        // Remove h2 since we already have it
        h2: () => null,
        // Handle footnotes
        sup: ({ children }) => {
          const id = children?.toString()
          if (id?.startsWith('[') && id?.endsWith(']')) {
            const num = id.slice(1, -1)
            return (
              <sup>
                <a href={`#fn${num}`} id={`fnref${num}`}>
                  {id}
                </a>
              </sup>
            )
          }
          return <sup>{children}</sup>
        },
        // Simple footnote rendering at bottom
        p: ({ children }) => {
          const text = children?.toString() || ''
          const footnoteMatch = text.match(/^\[(\^[\d]+)\]:\s*(.+)$/)
          if (footnoteMatch) {
            const [, ref, url] = footnoteMatch
            const num = ref.slice(1)
            return (
              <div id={`fn${num}`} style={{ fontSize: '0.9em', marginTop: '10px' }}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  [{ref}]: {url}
                </a>
              </div>
            )
          }
          return <p>{children}</p>
        }
      }}
    >
      {dedented}
    </ReactMarkdown>
  )
}