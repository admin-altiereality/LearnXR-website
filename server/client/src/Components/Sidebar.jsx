import React from 'react'
import { Link } from 'react-router-dom'

export default function Sidebar() {
  return (
    <aside className="w-64 bg-black bg-opacity-50 backdrop-blur-sm border-r border-gray-700/50 p-4 hidden md:block h-full">
      <div className="text-lg font-semibold text-white mb-6">Dashboard</div>
      <nav>
        <ul className="space-y-2">
          <li>
            <Link to="/settings" className="flex items-center text-gray-300 hover:text-white hover:bg-white/5 px-4 py-2 rounded-md transition-colors">
              <span>Settings</span>
            </Link>
          </li>
          <li>
            <Link to="/features" className="flex items-center text-gray-300 hover:text-white hover:bg-white/5 px-4 py-2 rounded-md transition-colors">
              <span>Features</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
