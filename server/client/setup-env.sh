#!/bin/bash

# In3D.ai Environment Setup Script
# This script helps you set up the required environment variables

echo "🚀 In3D.ai Environment Setup"
echo "============================"

# Check if .env file exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Backing up to .env.backup"
    cp .env .env.backup
fi

# Copy template to .env
if [ -f "env.template" ]; then
    cp env.template .env
    echo "✅ Created .env file from template"
else
    echo "❌ env.template not found. Please create .env file manually."
    exit 1
fi

echo ""
echo "🔧 Next Steps:"
echo "1. Edit the .env file and add your API keys:"
echo "   - VITE_MESHY_API_KEY (get from https://www.meshy.ai/settings/api-keys)"
echo "   - Firebase configuration (get from Firebase Console)"
echo "   - VITE_API_BASE_URL (should be http://localhost:3001 for development)"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Test the configuration by visiting the /main section"
echo ""
echo "📖 For detailed instructions, see MESHY_SETUP_GUIDE.md"
echo ""
echo "🎯 Quick test: Run 'npm run dev' and check the browser console for errors" 