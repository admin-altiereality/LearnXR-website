/**
 * Developer Settings Page
 * API Key management for the In3D Developer Portal
 * Shadcn design with theme toggle support
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FaPlus, FaBook, FaSync } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { fetchApiKeys, ApiKeyListItem } from '../services/apiKeyService';
import ApiKeyCreateModal from '../Components/developer/ApiKeyCreateModal';
import ApiKeyTable from '../Components/developer/ApiKeyTable';
import { Button } from '../Components/ui/button';
import { Card, CardContent } from '../Components/ui/card';
import { Badge } from '../Components/ui/badge';

const DeveloperSettings: React.FC = () => {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [regeneratedKeyResponse, setRegeneratedKeyResponse] = useState<any>(null);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  const handleKeyRegenerated = (response: any) => {
    setRegeneratedKeyResponse(response);
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8 md:space-y-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          >
            <div className="space-y-2">
              <Badge variant="secondary" className="text-xs uppercase tracking-wider">
                Developer Portal
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                API Keys
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Manage authentication credentials for programmatic access to In3D's generation APIs
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2 shrink-0">
              <FaPlus className="w-4 h-4" />
              Create Key
            </Button>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Link to="/docs/api" className="group block">
              <Card className="border-border bg-card hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FaBook className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      API Documentation
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Complete reference for integrating In3D's generation capabilities
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/docs/n8n" className="group block">
              <Card className="border-border bg-card hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FaSync className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      n8n Workflows
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Pre-built automation templates for seamless integration
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* API Keys Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Your API Keys
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {apiKeys.filter(k => !k.revoked).length} of 5 active keys
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={loadApiKeys}
                disabled={loading}
                title="Refresh"
              >
                <FaSync className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading ? (
              <Card className="border-border">
                <CardContent className="py-16 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Loading API keys...</p>
                </CardContent>
              </Card>
            ) : (
              <ApiKeyTable
                apiKeys={apiKeys}
                onRefresh={loadApiKeys}
                onKeyRegenerated={handleKeyRegenerated}
              />
            )}
          </motion.div>

          {/* Authentication Reference */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Card className="border-border bg-card">
              <CardContent className="p-6 md:p-8">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
                  Authentication Reference
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Authorization Header
                    </p>
                    <code className="block p-3 rounded-lg bg-muted border border-border text-foreground font-mono text-xs">
                      Authorization: Bearer<br />in3d_live_...
                    </code>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Custom Header
                    </p>
                    <code className="block p-3 rounded-lg bg-muted border border-border text-foreground font-mono text-xs">
                      X-In3d-Key:<br />in3d_live_...
                    </code>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Base URL
                    </p>
                    <code className="block p-3 rounded-lg bg-muted border border-border text-foreground font-mono text-xs">
                      https://api.in3d.ai<br />/v1
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <ApiKeyCreateModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setRegeneratedKeyResponse(null);
        }}
        onKeyCreated={loadApiKeys}
        preCreatedKey={regeneratedKeyResponse}
      />
    </div>
  );
};

export default DeveloperSettings;
