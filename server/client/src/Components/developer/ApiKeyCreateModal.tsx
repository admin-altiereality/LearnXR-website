/**
 * API Key Create Modal
 * Modal for creating new API keys with one-time key display
 * Shadcn design with theme toggle support
 */

import React, { useState, useEffect } from 'react';
import { FaKey, FaCopy, FaCheck, FaExclamationTriangle, FaLock, FaUnlock } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { createApiKey, CreateApiKeyResponse } from '../../services/apiKeyService';
import { ApiKeyScope } from '../../types/apiKey';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';

interface ApiKeyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: () => void;
  preCreatedKey?: CreateApiKeyResponse | null;
}

const ApiKeyCreateModal: React.FC<ApiKeyCreateModalProps> = ({
  isOpen,
  onClose,
  onKeyCreated,
  preCreatedKey
}) => {
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>(ApiKeyScope.READ);
  const [isLoading, setIsLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(preCreatedKey || null);
  const [copied, setCopied] = useState(false);

  // Update createdKey when preCreatedKey changes
  useEffect(() => {
    if (preCreatedKey) {
      setCreatedKey(preCreatedKey);
    } else if (!isOpen) {
      // Reset when modal closes
      setCreatedKey(null);
    }
  }, [preCreatedKey, isOpen]);

  const handleCreate = async () => {
    if (!label.trim()) {
      toast.error('Please enter a label for your API key');
      return;
    }

    setIsLoading(true);
    try {
      const response = await createApiKey(label.trim(), scope);
      setCreatedKey(response);
      onKeyCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey?.apiKey.rawKey) {
      await navigator.clipboard.writeText(createdKey.apiKey.rawKey);
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setLabel('');
    setScope(ApiKeyScope.READ);
    setCreatedKey(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FaKey className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-foreground">
                {createdKey ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              {!createdKey && (
                <p className="text-sm text-muted-foreground mt-1">Generate a new authentication credential</p>
              )}
            </div>
          </div>
        </DialogHeader>

        {!createdKey ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-foreground">Label</Label>
              <Input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Production Server, Development, n8n Workflow"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">A descriptive name to identify this key</p>
            </div>

            <div className="space-y-3">
              <Label className="text-foreground">Access Scope</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setScope(ApiKeyScope.READ)}
                  className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                    scope === ApiKeyScope.READ
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30 hover:border-primary/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <FaLock className={`w-6 h-6 ${scope === ApiKeyScope.READ ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-semibold ${scope === ApiKeyScope.READ ? 'text-foreground' : 'text-muted-foreground'}`}>Read Only</span>
                    <p className="text-xs text-muted-foreground text-center">View assets, history</p>
                  </div>
                  {scope === ApiKeyScope.READ && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setScope(ApiKeyScope.FULL)}
                  className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                    scope === ApiKeyScope.FULL
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30 hover:border-primary/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <FaUnlock className={`w-6 h-6 ${scope === ApiKeyScope.FULL ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-semibold ${scope === ApiKeyScope.FULL ? 'text-foreground' : 'text-muted-foreground'}`}>Full Access</span>
                    <p className="text-xs text-muted-foreground text-center">Generate 3D assets, skyboxes</p>
                  </div>
                  {scope === ApiKeyScope.FULL && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                  )}
                </button>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleCreate}
              disabled={isLoading || !label.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FaKey className="w-4 h-4" />
                  Generate API Key
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-amber-600/40 dark:border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/10">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <FaExclamationTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground mb-2">Save your API key now!</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      This key will only be shown once. Copy it and store it securely. You will not be able to see it again.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label className="text-foreground">Your API Key</Label>
              <div className="relative">
                <div className="p-5 pr-14 rounded-lg bg-muted border border-border font-mono text-sm text-foreground break-all">
                  {createdKey.apiKey.rawKey}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                >
                  {copied ? <FaCheck className="w-4 h-4 text-primary" /> : <FaCopy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Label</p>
                  <p className="text-sm font-semibold text-foreground">{createdKey.apiKey.label}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Scope</p>
                  <p className="text-sm font-semibold text-primary">
                    {createdKey.apiKey.scope === ApiKeyScope.FULL ? 'Full Access' : 'Read Only'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Button variant="outline" className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyCreateModal;
