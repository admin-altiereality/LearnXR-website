/**
 * n8n Workflows Documentation Page
 * Complete guide for setting up n8n workflows with In3D API
 * Editorial, technical aesthetic matching Developer Settings
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  FaArrowLeft,
  FaSync,
  FaKey,
  FaCode,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCopy,
  FaExternalLinkAlt,
  FaPlay,
  FaPause,
  FaArrowRight
} from 'react-icons/fa';

const N8nWorkflows: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const steps = [
    {
      id: 1,
      title: 'Get Your API Key',
      description: 'Create an API key from the Developer Portal',
      details: [
        'Log in to the In3D Developer Portal',
        'Navigate to Developer Settings → API Keys',
        'Click Create API Key',
        'Enter a label (e.g., "n8n Production Workflow")',
        'Select Full Access scope',
        'Copy the API key immediately - it will only be shown once!'
      ],
      code: null
    },
    {
      id: 2,
      title: 'Store API Key in n8n',
      description: 'Securely store your API key in n8n credentials',
      details: [
        'In n8n, go to Settings → Credentials',
        'Click Add Credential',
        'Search for HTTP Header Auth or Generic Credential Type',
        'Configure:',
        '  - Name: In3D API Key',
        '  - Header Name: X-In3d-Key',
        '  - Header Value: in3d_live_your_api_key_here',
        'Click Save'
      ],
      code: {
        type: 'credential',
        content: `Credential Name: In3D API Key
Header Name: X-In3d-Key
Header Value: in3d_live_your_api_key_here`
      }
    },
    {
      id: 3,
      title: 'Create Webhook Trigger',
      description: 'Set up a webhook to receive generation requests',
      details: [
        'Add Webhook node to your workflow',
        'Configure HTTP Method: POST',
        'Set Path: generate-3d-asset (or custom)',
        'Set Response Mode: When Last Node Finishes',
        'Expected Input Format:',
        '  {',
        '    "prompt": "A futuristic cityscape at sunset",',
        '    "style_id": 1,',
        '    "type": "skybox"',
        '  }'
      ],
      code: {
        type: 'json',
        content: `{
  "prompt": "A futuristic cityscape at sunset",
  "style_id": 1,
  "type": "skybox"
}`
      }
    },
    {
      id: 4,
      title: 'HTTP Request - Generate',
      description: 'Configure HTTP Request node to call In3D API',
      details: [
        'Add HTTP Request node',
        'Connect from Webhook Trigger',
        'Configure:',
        '  - Method: POST',
        '  - URL: https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate',
        '  - Authentication: Use your In3D API Key credential',
        '  - OR Manual Header:',
        '    Header Name: X-In3d-Key',
        '    Header Value: {{ $vars.in3d_api_key }}',
        '  - Send Body: true',
        '  - Body Content Type: JSON',
        '  - Body: Use webhook input data'
      ],
      code: {
        type: 'json',
        content: `{
  "prompt": "={{ $json.prompt }}",
  "style_id": "={{ $json.style_id || 1 }}",
  "negative_prompt": "={{ $json.negative_prompt || '' }}"
}`
      }
    },
    {
      id: 5,
      title: 'Poll for Status',
      description: 'Check generation status until completion',
      details: [
        'Add IF node after Generate request',
        'Condition: Check if status is "pending" or "processing"',
        'If true: Add Wait node (e.g., 5 seconds)',
        'Add HTTP Request node for status check:',
        '  - Method: GET',
        '  - URL: https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/status/{{ $json.data.generationId }}',
        '  - Authentication: Use In3D API Key credential',
        'Loop back to IF node until status is "completed"'
      ],
      code: {
        type: 'json',
        content: `Status Check Response:
{
  "success": true,
  "data": {
    "status": "completed",
    "file_url": "https://..."
  }
}`
      }
    },
    {
      id: 6,
      title: 'Return Result',
      description: 'Send the generated asset URL back to webhook',
      details: [
        'Add Respond to Webhook node',
        'Configure response data:',
        '  {',
        '    "success": true,',
        '    "generationId": "{{ $json.data.generationId }}",',
        '    "file_url": "{{ $json.data.file_url }}",',
        '    "status": "{{ $json.data.status }}"',
        '  }'
      ],
      code: {
        type: 'json',
        content: `{
  "success": true,
  "generationId": "={{ $json.data.generationId }}",
  "file_url": "={{ $json.data.file_url }}",
  "status": "={{ $json.data.status }}"
}`
      }
    }
  ];

  const workflowExample = {
    nodes: [
      { name: 'Webhook', type: 'trigger' },
      { name: 'HTTP Request (Generate)', type: 'action' },
      { name: 'IF (Check Status)', type: 'logic' },
      { name: 'Wait', type: 'action' },
      { name: 'HTTP Request (Status)', type: 'action' },
      { name: 'Respond to Webhook', type: 'action' }
    ]
  };

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
            background: 'radial-gradient(ellipse at center, rgba(251, 146, 60, 0.1) 0%, transparent 70%)'
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-orange-800/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-900/5 rounded-full blur-3xl" />
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
            <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-orange-500/40 via-orange-600/20 to-transparent" />
            
            <div className="pl-8 md:pl-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-4"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
                <span className="text-xs uppercase tracking-wider font-medium text-orange-400/70 font-display">
                  Automation Guide
                </span>
              </motion.div>

              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-8">
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight font-display tracking-tight">
                    n8n Workflows
                  </h1>
                  <p className="text-lg md:text-xl text-orange-100/60 font-body max-w-2xl leading-relaxed">
                    Pre-built automation templates for seamless integration with In3D's generation APIs
                  </p>
                </div>

                <Link
                  to="/developer"
                  className="group inline-flex items-center gap-2 px-4 py-2 text-orange-400/70 hover:text-orange-300 transition-colors font-display text-sm uppercase tracking-wide"
                >
                  <FaArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Portal</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Prerequisites */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-orange-900/30 backdrop-blur-sm"
          >
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-orange-800/30" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-orange-800/30" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-orange-800/30" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-orange-800/30" />
            
            <div className="relative">
              <h2 className="text-xl font-bold text-white mb-4 font-display">Prerequisites</h2>
              <ul className="space-y-2 text-amber-100/60 font-body">
                <li className="flex items-start gap-2">
                  <FaCheckCircle className="w-4 h-4 text-orange-400/70 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-orange-200">n8n Instance:</strong> Self-hosted or n8n.cloud account</span>
                </li>
                <li className="flex items-start gap-2">
                  <FaCheckCircle className="w-4 h-4 text-orange-400/70 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-orange-200">In3D API Key:</strong> Create one in the Developer Portal (Full Access scope required for generation)</span>
                </li>
                <li className="flex items-start gap-2">
                  <FaCheckCircle className="w-4 h-4 text-orange-400/70 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-orange-200">Basic n8n Knowledge:</strong> Familiarity with n8n nodes and workflows</span>
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Workflow Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-orange-500 to-orange-600/50" />
              <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                Workflow Overview
              </h2>
            </div>

            <div className="p-6 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-orange-900/30 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-3 justify-center">
                {workflowExample.nodes.map((node, index) => (
                  <React.Fragment key={index}>
                    <div className="px-4 py-2 bg-[#0f0d0a] border border-orange-900/30">
                      <span className="text-sm text-orange-300/80 font-display font-semibold">{node.name}</span>
                    </div>
                    {index < workflowExample.nodes.length - 1 && (
                      <FaArrowRight className="w-4 h-4 text-orange-400/50" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Step-by-Step Guide */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-orange-500 to-orange-600/50" />
              <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                Step-by-Step Setup
              </h2>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative group"
                >
                  <div className="relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-orange-900/30 backdrop-blur-sm hover:border-orange-700/50 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500/60 to-orange-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 flex items-center justify-center bg-orange-900/20 border border-orange-800/30 text-orange-400/80 font-bold font-display text-lg">
                          {step.id}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2 font-display">
                            {step.title}
                          </h3>
                          <p className="text-orange-100/60 font-body leading-relaxed">
                            {step.description}
                          </p>
                        </div>

                        <button
                          onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                          className="flex items-center gap-2 text-orange-400/70 hover:text-orange-300 transition-colors font-display text-sm uppercase tracking-wide"
                        >
                          {activeStep === step.id ? (
                            <>
                              <FaPause className="w-3.5 h-3.5" />
                              <span>Hide Details</span>
                            </>
                          ) : (
                            <>
                              <FaPlay className="w-3.5 h-3.5" />
                              <span>Show Details</span>
                            </>
                          )}
                        </button>

                        {activeStep === step.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4 pt-4 border-t border-orange-900/20"
                          >
                            <ul className="space-y-2 text-sm text-orange-100/60 font-body">
                              {step.details.map((detail, detailIndex) => (
                                <li key={detailIndex} className="flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0 mt-1.5" />
                                  <span>{detail}</span>
                                </li>
                              ))}
                            </ul>

                            {step.code && (
                              <div>
                                <p className="text-xs text-orange-100/40 font-display uppercase tracking-wide mb-2">
                                  {step.code.type === 'json' ? 'Example' : 'Configuration'}
                                </p>
                                <pre className="p-4 bg-[#0a0806] border border-orange-900/30 text-orange-300/90 font-mono text-xs overflow-x-auto">
                                  <code>{step.code.content}</code>
                                </pre>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Reference */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-orange-900/30 backdrop-blur-sm"
          >
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-orange-800/30" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-orange-800/30" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-orange-800/30" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-orange-800/30" />
            
            <div className="relative">
              <h2 className="text-xl font-bold text-white mb-6 font-display">Quick Reference</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-orange-200 mb-3 font-display uppercase tracking-wide">
                    Generate Endpoint
                  </h3>
                  <div className="space-y-2">
                    <code className="block p-3 bg-[#0a0806] border border-orange-900/20 text-orange-300/90 font-mono text-xs">
                      POST /skybox/generate
                    </code>
                    <code className="block p-3 bg-[#0a0806] border border-orange-900/20 text-orange-300/90 font-mono text-xs">
                      POST /meshy/generate
                    </code>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-orange-200 mb-3 font-display uppercase tracking-wide">
                    Status Endpoint
                  </h3>
                  <div className="space-y-2">
                    <code className="block p-3 bg-[#0a0806] border border-orange-900/20 text-orange-300/90 font-mono text-xs">
                      GET /skybox/status/:id
                    </code>
                    <code className="block p-3 bg-[#0a0806] border border-orange-900/20 text-orange-300/90 font-mono text-xs">
                      GET /meshy/status/:id
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tips & Best Practices */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 bg-orange-950/20 border border-orange-900/30"
          >
            <div className="flex items-start gap-4">
              <FaExclamationTriangle className="w-6 h-6 text-orange-400/70 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-orange-200 mb-3 font-display">Tips & Best Practices</h3>
                <ul className="space-y-2 text-sm text-orange-100/60 font-body">
                  <li>• Use n8n credentials to securely store your API key</li>
                  <li>• Set appropriate wait times between status checks (5-10 seconds)</li>
                  <li>• Implement error handling for failed generations</li>
                  <li>• Use webhook response mode for async operations</li>
                  <li>• Monitor your API usage and credits in the Developer Portal</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default N8nWorkflows;
