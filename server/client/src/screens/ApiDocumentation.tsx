/**
 * API Documentation Page
 * Complete API reference for In3D Developer Portal
 * Editorial, technical aesthetic matching Developer Settings
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  FaArrowLeft,
  FaKey,
  FaLock,
  FaUnlock,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle
} from 'react-icons/fa';

const ApiDocumentation: React.FC = () => {
  const endpoints = [
    {
      category: 'Skybox Generation',
      endpoints: [
        {
          method: 'GET',
          path: '/skybox/styles',
          description: 'Retrieve available skybox styles',
          auth: 'READ or FULL',
          params: [
            { name: 'page', type: 'integer', required: false, default: '1', description: 'Page number' },
            { name: 'limit', type: 'integer', required: false, default: '100', description: 'Items per page' }
          ],
          example: {
            request: 'GET /skybox/styles?page=1&limit=10',
            response: {
              success: true,
              data: [{ id: 1, name: 'Style Name', description: '...' }],
              pagination: { page: 1, limit: 10, total: 84 }
            }
          }
        },
        {
          method: 'POST',
          path: '/skybox/generate',
          description: 'Generate a new skybox',
          auth: 'FULL',
          params: [
            { name: 'prompt', type: 'string', required: true, description: 'Text description of the skybox' },
            { name: 'style_id', type: 'integer', required: true, description: 'Style ID from /styles endpoint' },
            { name: 'negative_prompt', type: 'string', required: false, description: 'Elements to avoid' }
          ],
          example: {
            request: 'POST /skybox/generate\nHeaders: X-In3d-Key: in3d_live_...\nBody: { "prompt": "A sunset over mountains", "style_id": 1 }',
            response: {
              success: true,
              data: { generationId: '12345678', status: 'pending' }
            }
          }
        },
        {
          method: 'GET',
          path: '/skybox/status/:generationId',
          description: 'Check generation status',
          auth: 'READ or FULL',
          params: [
            { name: 'generationId', type: 'string', required: true, description: 'Generation ID from /generate response' }
          ],
          example: {
            request: 'GET /skybox/status/12345678',
            response: {
              success: true,
              data: { status: 'completed', file_url: 'https://...' }
            }
          }
        }
      ]
    },
    {
      category: '3D Asset Generation',
      endpoints: [
        {
          method: 'POST',
          path: '/meshy/generate',
          description: 'Generate a 3D asset using Meshy.ai',
          auth: 'FULL',
          params: [
            { name: 'prompt', type: 'string', required: true, description: 'Text description of the 3D asset' },
            { name: 'art_style', type: 'string', required: false, default: 'realistic', description: 'Art style preference' },
            { name: 'ai_model', type: 'string', required: false, default: 'meshy-4', description: 'AI model version' }
          ],
          example: {
            request: 'POST /meshy/generate\nHeaders: X-In3d-Key: in3d_live_...\nBody: { "prompt": "A detailed medieval sword", "art_style": "realistic" }',
            response: {
              success: true,
              data: { id: 'task_abc123', status: 'pending' }
            }
          }
        },
        {
          method: 'GET',
          path: '/meshy/status/:taskId',
          description: 'Check 3D asset generation status',
          auth: 'READ or FULL',
          params: [
            { name: 'taskId', type: 'string', required: true, description: 'Task ID from /generate response' }
          ],
          example: {
            request: 'GET /meshy/status/task_abc123',
            response: {
              success: true,
              data: { status: 'completed', model_urls: { glb: 'https://...' } }
            }
          }
        }
      ]
    }
  ];

  const errorCodes = [
    { code: 'AUTH_REQUIRED', status: 401, description: 'Authentication required or failed' },
    { code: 'INVALID_API_KEY', status: 401, description: 'API key is invalid or revoked' },
    { code: 'INSUFFICIENT_SCOPE', status: 403, description: 'API key scope is insufficient' },
    { code: 'QUOTA_EXCEEDED', status: 403, description: 'Generation quota exceeded' },
    { code: 'MISSING_REQUIRED_FIELD', status: 400, description: 'Required field is missing' },
    { code: 'VALIDATION_ERROR', status: 400, description: 'Invalid request parameters' },
    { code: 'RATE_LIMIT_EXCEEDED', status: 429, description: 'Too many requests' },
    { code: 'CREDITS_EXHAUSTED', status: 429, description: 'No credits remaining' }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Layered Background with Texture */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0806] via-[#1a1612] to-[#0f0d0a]" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px'
          }}
        />
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.1) 0%, transparent 70%)'
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-800/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-orange-900/5 rounded-full blur-3xl" />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }}
        />
      </div>

      <div className="relative py-12 sm:py-16 md:py-20 lg:py-28 px-4 sm:px-6 lg:px-8 mt-20">
        <div className="max-w-6xl mx-auto space-y-12 md:space-y-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/40 via-amber-600/20 to-transparent" />
            
            <div className="pl-8 md:pl-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-4"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                <span className="text-xs uppercase tracking-wider font-medium text-amber-400/70 font-display">
                  API Reference
                </span>
              </motion.div>

              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-8">
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight font-display tracking-tight">
                    API Documentation
                  </h1>
                  <p className="text-lg md:text-xl text-amber-100/60 font-body max-w-2xl leading-relaxed">
                    Complete reference for integrating In3D's generation capabilities into your applications
                  </p>
                </div>

                <Link
                  to="/developer"
                  className="group inline-flex items-center gap-2 px-4 py-2 text-amber-400/70 hover:text-amber-300 transition-colors font-display text-sm uppercase tracking-wide"
                >
                  <FaArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Portal</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Base URL Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 backdrop-blur-sm"
          >
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-800/30" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-800/30" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-800/30" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-800/30" />
            
            <div className="relative">
              <h2 className="text-xl font-bold text-white mb-4 font-display">Base URL</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">Production</p>
                  <code className="block p-4 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-sm">
                    https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api
                  </code>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">Local Development</p>
                  <code className="block p-4 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-sm">
                    http://localhost:5001/in3devoneuralai/us-central1/api
                  </code>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Authentication Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-amber-500 to-amber-600/50" />
              <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                Authentication
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-amber-900/20 border border-amber-800/30">
                    <FaKey className="w-5 h-5 text-amber-400/80" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-display">API Key</h3>
                </div>
                <p className="text-sm text-amber-100/60 font-body mb-4 leading-relaxed">
                  Recommended for n8n and external integrations
                </p>
                <div className="space-y-2">
                  <code className="block p-3 bg-[#0a0806] border border-amber-900/20 text-amber-300/90 font-mono text-xs">
                    Authorization: Bearer in3d_live_...
                  </code>
                  <code className="block p-3 bg-[#0a0806] border border-amber-900/20 text-amber-300/90 font-mono text-xs">
                    X-In3d-Key: in3d_live_...
                  </code>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-orange-900/20 border border-orange-800/30">
                    <FaLock className="w-5 h-5 text-orange-400/80" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-display">Firebase Auth</h3>
                </div>
                <p className="text-sm text-amber-100/60 font-body mb-4 leading-relaxed">
                  For web applications using Firebase Authentication
                </p>
                <code className="block p-3 bg-[#0a0806] border border-amber-900/20 text-amber-300/90 font-mono text-xs">
                  Authorization: Bearer {'<firebase_id_token>'}
                </code>
              </div>
            </div>

            <div className="p-6 bg-amber-950/20 border border-amber-900/30">
              <div className="flex items-start gap-3">
                <FaInfoCircle className="w-5 h-5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-200 mb-2 font-display">API Key Scopes</h4>
                  <div className="space-y-2 text-sm text-amber-100/60 font-body">
                    <div className="flex items-center gap-2">
                      <FaLock className="w-3.5 h-3.5 text-amber-400/60" />
                      <span><strong className="text-amber-200">READ:</strong> View-only access (styles, status, history)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaUnlock className="w-3.5 h-3.5 text-orange-400/60" />
                      <span><strong className="text-orange-200">FULL:</strong> Full access including generation capabilities</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Endpoints */}
          {endpoints.map((category, categoryIndex) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + categoryIndex * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-amber-500 to-amber-600/50" />
                <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                  {category.category}
                </h2>
              </div>

              <div className="space-y-6">
                {category.endpoints.map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className="relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 backdrop-blur-sm group hover:border-amber-700/50 transition-all duration-300"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500/60 to-amber-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-3 py-1 font-bold text-xs font-display uppercase tracking-wide ${
                          endpoint.method === 'GET' 
                            ? 'bg-amber-900/30 text-amber-300 border border-amber-800/40'
                            : 'bg-orange-900/30 text-orange-300 border border-orange-800/40'
                        }`}>
                          {endpoint.method}
                        </span>
                        <code className="text-lg font-mono text-amber-300/90 font-semibold">
                          {endpoint.path}
                        </code>
                        <span className={`px-2.5 py-1 text-xs font-semibold font-display uppercase ${
                          endpoint.auth === 'FULL'
                            ? 'bg-orange-900/20 text-orange-300/80 border border-orange-800/30'
                            : 'bg-amber-900/20 text-amber-300/80 border border-amber-800/30'
                        }`}>
                          {endpoint.auth}
                        </span>
                      </div>

                      <p className="text-amber-100/70 font-body leading-relaxed">
                        {endpoint.description}
                      </p>

                      {endpoint.params && endpoint.params.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-amber-200 mb-3 font-display uppercase tracking-wide">
                            Parameters
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-amber-900/30">
                                  <th className="text-left py-2 px-3 text-amber-300/70 font-display uppercase text-xs tracking-wide">Name</th>
                                  <th className="text-left py-2 px-3 text-amber-300/70 font-display uppercase text-xs tracking-wide">Type</th>
                                  <th className="text-left py-2 px-3 text-amber-300/70 font-display uppercase text-xs tracking-wide">Required</th>
                                  <th className="text-left py-2 px-3 text-amber-300/70 font-display uppercase text-xs tracking-wide">Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {endpoint.params.map((param, paramIndex) => (
                                  <tr key={paramIndex} className="border-b border-amber-900/10">
                                    <td className="py-2 px-3">
                                      <code className="text-amber-300/90 font-mono text-xs">{param.name}</code>
                                    </td>
                                    <td className="py-2 px-3 text-amber-100/50 font-body text-xs">{param.type}</td>
                                    <td className="py-2 px-3">
                                      {param.required ? (
                                        <span className="text-red-400/70 text-xs">Required</span>
                                      ) : (
                                        <span className="text-amber-100/40 text-xs">Optional</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-amber-100/50 font-body text-xs">{param.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {endpoint.example && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-amber-200 mb-2 font-display uppercase tracking-wide">
                            Example
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-amber-100/40 font-display uppercase tracking-wide mb-2">Request</p>
                              <pre className="p-4 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-xs overflow-x-auto">
                                <code>{endpoint.example.request}</code>
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-amber-100/40 font-display uppercase tracking-wide mb-2">Response</p>
                              <pre className="p-4 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-xs overflow-x-auto">
                                <code>{JSON.stringify(endpoint.example.response, null, 2)}</code>
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Error Codes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-amber-500 to-amber-600/50" />
              <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                Error Codes
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-amber-900/30">
                    <th className="text-left py-3 px-4 text-amber-300/70 font-display uppercase text-xs tracking-wide">HTTP Status</th>
                    <th className="text-left py-3 px-4 text-amber-300/70 font-display uppercase text-xs tracking-wide">Error Code</th>
                    <th className="text-left py-3 px-4 text-amber-300/70 font-display uppercase text-xs tracking-wide">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {errorCodes.map((error) => (
                    <tr key={`${error.status}-${error.code}`} className="border-b border-amber-900/10 hover:bg-amber-950/10 transition-colors">
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-amber-900/20 border border-amber-800/30 text-amber-300/80 text-xs font-semibold font-display">
                          {error.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-amber-300/90 font-mono text-sm">{error.code}</code>
                      </td>
                      <td className="py-3 px-4 text-amber-100/60 font-body text-sm">{error.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Response Format */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-amber-500 to-amber-600/50" />
              <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                Response Format
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FaCheckCircle className="w-5 h-5 text-amber-400/70" />
                  <h3 className="text-lg font-bold text-white font-display">Success Response</h3>
                </div>
                <pre className="p-4 bg-[#0a0806] border border-amber-900/20 text-amber-300/90 font-mono text-xs overflow-x-auto">
                  <code>{JSON.stringify({
                    success: true,
                    data: { /* response data */ },
                    message: "Operation completed",
                    requestId: "req_1234567890",
                    timestamp: "2024-01-15T10:30:00.000Z"
                  }, null, 2)}</code>
                </pre>
              </div>

              <div className="p-6 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FaTimesCircle className="w-5 h-5 text-red-400/70" />
                  <h3 className="text-lg font-bold text-white font-display">Error Response</h3>
                </div>
                <pre className="p-4 bg-[#0a0806] border border-amber-900/20 text-amber-300/90 font-mono text-xs overflow-x-auto">
                  <code>{JSON.stringify({
                    success: false,
                    error: "Error Type",
                    message: "Human-readable message",
                    code: "ERROR_CODE",
                    requestId: "req_1234567890",
                    timestamp: "2024-01-15T10:30:00.000Z"
                  }, null, 2)}</code>
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocumentation;
