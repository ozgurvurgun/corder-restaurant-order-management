import { useEffect, useState } from "react"
import { Navbar } from "./components/Navbar"
import { HeroSection } from "./components/HeroSection"
import { EcosystemExplorer } from "./components/EcosystemExplorer"
import { ArchitectureFlowSection } from "./components/ArchitectureFlowSection"
import { DeepDiveSpecsSection } from "./components/DeepDiveSpecsSection"
import { FooterSection } from "./components/FooterSection"

export default function App() {
  const [activeSection, setActiveSection] = useState("ecosystem")

  useEffect(() => {
    const sectionIds = ["ecosystem", "workflows", "simulator", "specs", "topology"]
    const handleScroll = () => {
      const scrollPos = window.scrollY + 180
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(id)
            break
          }
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] text-[#1d1d1f]">
      <Navbar activeSection={activeSection} />
      <main className="flex-1">
        <HeroSection />
        <EcosystemExplorer />
        <ArchitectureFlowSection />
        <DeepDiveSpecsSection />
      </main>
      <FooterSection />
    </div>
  )
}

