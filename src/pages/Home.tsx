import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, GraduationCap, Target, ArrowRight, User, Settings, LogOut, ChartBar, ChevronDown, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4 md:mb-0 md:absolute md:top-6 md:left-4 z-10">
            {user ? (
                   <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="font-bold gap-2">
                       <User className="w-4 h-4" />
                       Account
                       <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                     <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <ChartBar className="mr-2 h-4 w-4" />
                      <span>Statistics</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()} className="text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                  Log In
                </Button>
                <Button size="sm" onClick={() => navigate("/signup")}>
                  Sign Up
                </Button>
              </div>
            )}
            
            {/* Mobile-only right side items could go here if needed, but we keep it simple */}
          </div>
          
          <div className="absolute top-4 right-4 print:hidden">
             <ThemeToggle />
          </div>

          <div className="text-center pt-8 md:pt-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              1600.now
            </h1>
            <p className="text-muted-foreground mt-2">Master the SAT with comprehensive practice</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold mb-2">Choose Your Practice Mode</h2>
            <p className="text-muted-foreground">Select an option below to start studying</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Module Based Practice Card */}
            <Card 
              className="group p-8 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500/50 flex flex-col"
              onClick={() => navigate("/modules")}
            >
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors mb-4">
                  <BookOpen className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Practice Modules</h3>
                <p className="text-muted-foreground text-sm flex-1">
                  Take full-length SAT practice modules and track your progress
                </p>
              </div>
              <Button className="w-full mt-6" variant="outline">
                View Modules
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Card>

            {/* Vocab Card */}
            <Card 
              className="group p-8 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-green-500/50 flex flex-col"
              onClick={() => navigate("/vocab")}
            >
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors mb-4">
                  <GraduationCap className="h-12 w-12 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Vocabulary</h3>
                <p className="text-muted-foreground text-sm flex-1">
                  Master high & mid frequency SAT words with interactive flashcards
                </p>
              </div>
              <Button className="w-full mt-6 group-hover:bg-green-600" variant="outline">
                Start Learning
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Card>

            {/* 100 Hard Questions Card */}
            <Card 
              className="group p-8 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/50 flex flex-col"
              onClick={() => navigate("/question/1")}
            >
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                  <Trophy className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">100 Hard Questions</h3>
                <p className="text-muted-foreground text-sm flex-1">
                  Challenge yourself with curated difficult SAT problems
                </p>
              </div>
              <Button className="w-full mt-6" variant="outline">
                Take Challenge
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Card>

            {/* SAT-Style Question Bank Card */}
            <Card 
              className="group p-8 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-purple-500/50 flex flex-col"
              onClick={() => navigate("/bank")}
            >
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors mb-4">
                  <Target className="h-12 w-12 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Question Bank</h3>
                <p className="text-muted-foreground text-sm flex-1">
                  5,880+ SAT-style questions organized by topic and skill
                </p>
              </div>
              <Button className="w-full mt-6" variant="outline">
                Browse Questions
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2024 1600.now - SAT Practice Platform</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
