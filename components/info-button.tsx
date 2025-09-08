"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

export function InfoButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full border-neutral-700 bg-neutral-900/80 backdrop-blur-sm hover:bg-neutral-800 hover:border-neutral-600 shadow-lg transition-all duration-200"
          aria-label="Project Information"
        >
          <HelpCircle className="h-5 w-5 text-neutral-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-hide bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <HelpCircle className="w-5 h-5 text-teal-400" />
            </div>
            About CREDENCE
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-neutral-300">
          <div className="prose prose-invert max-w-none">
            <h3 className="text-lg font-semibold text-white mb-2">Welcome to CREDENCE</h3>
            <p className="text-sm leading-relaxed">
              CREDENCE is the next-generation AI-powered workspace that transforms how teams collaborate, 
              manage projects, and secure their data. Built for modern organizations that demand both 
              productivity and security, CREDENCE combines intelligent automation with enterprise-grade 
              protection to deliver unprecedented efficiency.
            </p>
            
            <h4 className="text-md font-semibold text-white mt-4 mb-2">Why CREDENCE Matters</h4>
            <p className="text-sm leading-relaxed mb-3">
              In today's fast-paced business environment, teams need more than just tools—they need 
              intelligent systems that understand context, automate routine tasks, and protect sensitive 
              information. CREDENCE delivers exactly that.
            </p>
            
            <h4 className="text-md font-semibold text-white mt-4 mb-2">Real-World Impact</h4>
            <ul className="text-sm space-y-2 list-disc list-inside">
              <li><strong>Finance Teams:</strong> Automate invoice processing, generate cashflow reports, and maintain audit trails with AI-powered insights</li>
              <li><strong>Project Managers:</strong> Track team progress, assign tasks intelligently, and predict project bottlenecks before they happen</li>
              <li><strong>Legal Departments:</strong> Secure document collaboration with granular permissions and comprehensive audit logs</li>
              <li><strong>Healthcare Organizations:</strong> Manage patient data securely while enabling seamless team coordination</li>
              <li><strong>Consulting Firms:</strong> Organize client work, share insights safely, and maintain compliance across multiple projects</li>
              <li><strong>Startups:</strong> Scale team collaboration without compromising security or losing productivity</li>
            </ul>
            
            <h4 className="text-md font-semibold text-white mt-4 mb-2">What Makes CREDENCE Special</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>AI that actually understands your workflow and suggests improvements</li>
              <li>Military-grade security with user-friendly design</li>
              <li>Seamless integration with your existing tools and calendars</li>
              <li>Real-time collaboration without compromising data privacy</li>
              <li>Intelligent task prioritization based on deadlines and dependencies</li>
              <li>Comprehensive audit trails for compliance and accountability</li>
            </ul>
            
            <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20">
              <p className="text-sm text-teal-300 font-medium">
                🚀 Ready to transform your team's productivity? CREDENCE adapts to your workflow, 
                learns from your patterns, and grows with your organization.
              </p>
            </div>
            
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
