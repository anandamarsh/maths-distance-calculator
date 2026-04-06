import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function loadEnvLocal() {
  try {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/)
      if (m) process.env[m[1]] ??= m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // No local env file.
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function localApiPlugin() {
  return {
    name: 'local-api-send-report',
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          fn: (req: any, res: any, next: () => void) => void,
        ) => void
      }
    }) {
      loadEnvLocal()

      server.middlewares.use('/api/send-report', (req, res, _next) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed.' }))
          return
        }

        let raw = ''
        req.on('data', (chunk: Buffer) => {
          raw += chunk.toString()
        })
        req.on('end', async () => {
          try {
            const payload: Record<string, string | number> = JSON.parse(raw)
            const apiKey = process.env.RESEND_API_KEY
            const from = process.env.EMAIL_FROM

            if (!apiKey || !from) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  error:
                    'Email service is not configured (missing RESEND_API_KEY / EMAIL_FROM in .env.local).',
                }),
              )
              return
            }

            const email = String(payload.email ?? '').trim()
            const pdfBase64 = String(payload.pdfBase64 ?? '').trim()

            if (!email || !pdfBase64) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing email or PDF.' }))
              return
            }

            const reportFileName = String(payload.reportFileName || 'distance-report.pdf')
            const scoreLine = `${payload.correctCount ?? 0}/${payload.totalQuestions ?? 0}`
            const accuracy = `${payload.accuracy ?? 0}%`
            const senderName = String(payload.senderName || 'Distance Calculator')
            const gameName = String(payload.gameName || 'Distance Calculator')
            const siteUrl = String(payload.siteUrl || 'https://www.seemaths.com')
            const sessionTime = String(payload.sessionTime || 'Unknown time')
            const sessionDate = String(payload.sessionDate || 'Unknown date')
            const durationText = String(payload.durationText || 'an unknown duration')
            const stageLabel = String(payload.stageLabel || 'NSW Curriculum')
            const curriculumCode = String(payload.curriculumCode || 'N/A')
            const curriculumDescription = String(
              payload.curriculumDescription || 'No curriculum description supplied.',
            )
            const curriculumUrl = String(payload.curriculumUrl || 'https://www.seemaths.com')
            const curriculumIndexUrl = String(
              payload.curriculumIndexUrl ||
                'https://www.educationstandards.nsw.edu.au/wps/portal/nesa/k-10/learning-areas/mathematics/mathematics-k-10',
            )
            const curriculumText = `${curriculumCode} - ${curriculumDescription}`

            const resendResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `${senderName} <${from}>`,
                to: [email],
                subject: `${gameName} Report`,
                html: `
                  <p>Hi there,</p>
                  <p>
                    A player played <strong>${escapeHtml(gameName)}</strong> at
                    <a href="${escapeHtml(siteUrl)}">SeeMaths</a>
                    at <strong>${escapeHtml(sessionTime)}</strong> on <strong>${escapeHtml(sessionDate)}</strong> for
                    <strong>${escapeHtml(durationText)}</strong>. They scored <strong>${escapeHtml(scoreLine)}</strong>
                    and had an accuracy of <strong>${escapeHtml(accuracy)}</strong>.
                  </p>
                  <p>
                    This game is equivalent to <a href="${escapeHtml(curriculumIndexUrl)}"><strong>${escapeHtml(stageLabel)}</strong></a> on topic
                    <a href="${escapeHtml(curriculumUrl)}"><strong>${escapeHtml(curriculumText)}</strong></a>.
                  </p>
                  <p>
                    Regards,<br />
                    ${escapeHtml(gameName)}<br />
                    <a href="${escapeHtml(siteUrl)}">SeeMaths</a>
                  </p>
                `,
                attachments: [{ filename: reportFileName, content: pdfBase64 }],
              }),
            })

            if (!resendResponse.ok) {
              const errorText = await resendResponse.text()
              console.error('[API /api/send-report] Resend error:', errorText)
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Report email could not be sent.' }))
              return
            }

            console.log(`[API /api/send-report] Sent to ${email}`)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch (error) {
            console.error('[API /api/send-report] Error:', error)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: String(error) }))
          }
        })
      })
    },
  }
}

export default defineConfig(() => ({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    localApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: false, // use existing public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 4001,
    strictPort: true,
  },
}))
