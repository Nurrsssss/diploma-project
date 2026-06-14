'use client'

import { ChevronDown } from 'lucide-react'
import React from 'react'

interface IDropdownTabsProps {
  tabs: { label: string; value: string; icon: React.ReactNode }[]
  activeTab: string
  setActiveTab: (tab: string) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (open: boolean) => void
}

export default function DropdownTabs({
  tabs,
  activeTab,
  setActiveTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: IDropdownTabsProps) {
  const activeTabData = tabs.find((tab) => tab.value === activeTab)

  return (
    <div className="p-4">
      <p className="text-lg font-bold mb-2">Выбор раздела</p>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-full flex items-center justify-between p-3 bg-primary text-white rounded-xl transition-all duration-300 hover:bg-primary/90 active:scale-95"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              {activeTabData?.icon}
            </div>
            <span className="font-semibold">{activeTabData?.label}</span>
          </div>

          <ChevronDown
            className={`w-5 h-5 transition-transform duration-300 ${
              isMobileMenuOpen ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveTab(tab.value)
                  setIsMobileMenuOpen(false)
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  activeTab === tab.value
                    ? 'bg-primary/20 text-primary border border-primary'
                    : 'hover:bg-gray-50 text-gray-700'
                } transform hover:scale-[1.02] active:scale-95`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    activeTab === tab.value
                      ? 'bg-primary/20 text-primary'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.icon}
                </div>

                <span className="font-medium">{tab.label}</span>

                {activeTab === tab.value && (
                  <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}