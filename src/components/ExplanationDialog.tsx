import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Youtube } from "lucide-react";

interface ExplanationDialogProps {
  videoUrl?: string;
}

export const ExplanationDialog = ({ videoUrl }: ExplanationDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Youtube className="mr-2 h-4 w-4" />
          Explanation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Video Explanation</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
          {videoUrl ? (
            <iframe
              src={videoUrl}
              className="w-full h-full rounded-md"
              title="Explanation Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <p className="text-muted-foreground">Video explanation coming soon</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
