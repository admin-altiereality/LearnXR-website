/**
 * Associate Dashboard - Academic Associate (lesson refinement role).
 * Sidebar for Associate shows only: Dashboard, Lessons.
 * Associate can refine lessons (add images, skybox, 3D, MCQs, avatar script, audio) and submit for approval.
 * Cannot delete any content.
 */

import { Link } from 'react-router-dom';
import { FaBookOpen, FaTachometerAlt, FaEdit, FaClipboardCheck } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../Components/ui/card';
import { Button } from '../../Components/ui/button';

const AssociateDashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
            <FaTachometerAlt className="text-primary text-xl" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
              <span className="text-foreground">Learn</span>
              <span className="text-primary">XR</span>
              <TrademarkSymbol />
            </h1>
            <h2 className="text-xl font-semibold text-foreground">Associate Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Refine lesson content and submit changes for approval
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <FaEdit className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg text-foreground">Refine Lessons</CardTitle>
              <CardDescription>
                Open the content library to edit lessons: add images, skybox, 3D assets, MCQs, avatar script, and generate audio. Your changes will be sent for Admin approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full gap-2" variant="default">
                <Link to="/studio/content" className="flex items-center justify-center gap-2">
                  <FaBookOpen className="h-4 w-4 shrink-0" />
                  Open Content Library
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <FaBookOpen className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg text-foreground">Browse Lessons</CardTitle>
              <CardDescription>
                View and launch lessons as a learner. Use this to preview how lessons look before or after refining.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full gap-2" variant="outline">
                <Link to="/lessons" className="flex items-center justify-center gap-2">
                  <FaBookOpen className="h-4 w-4 shrink-0" />
                  Go to Lessons
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FaClipboardCheck className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base text-foreground">Approval workflow</CardTitle>
            </div>
            <CardDescription>
              You can edit lesson elements (images, skybox, 3D assets, MCQs, avatar script, audio). You cannot delete content. When you are done, use &quot;Submit for approval&quot; in the chapter editor. An Admin or Super Admin will review and approve or reject your changes.
            </CardDescription>
          </CardHeader>
        </Card>

      </div>
    </div>
  );
};

export default AssociateDashboard;
