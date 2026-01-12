import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Target, Trophy } from "lucide-react";
const Index = () => {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-12">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Target className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            1600.now
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Master the SAT Math section with our comprehensive question bank. 
            Practice with real-world problems and achieve your perfect score.
          </p>
          <Button size="lg" className="text-lg px-8" onClick={() => navigate("/question/1")}>
            <BookOpen className="mr-2 h-5 w-5" />
            Start Practicing
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">99 Questions</h3>
            <p className="text-muted-foreground">
              Comprehensive question bank covering all SAT Math topics with detailed explanations.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Built-in Tools</h3>
            <p className="text-muted-foreground">
              Access Desmos calculator and formula sheets just like the real SAT exam.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
              <Trophy className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Video Explanations</h3>
            <p className="text-muted-foreground">
              Learn from detailed video walkthroughs for every single problem.
            </p>
          </Card>
        </div>
      </section>

      {/* Quick Start */}
      

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2024 1600.now - SAT Math Practice Platform</p>
        </div>
      </footer>
    </div>;
};
export default Index;