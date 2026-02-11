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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <FaTachometerAlt className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" style={learnXRFontStyle}>
              Associate Dashboard
            </h1>
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
              <Button asChild className="w-full" variant="default">
                <Link to="/studio/content">
                  Open Content Library
                  <FaBookOpen className="ml-2 h-4 w-4" />
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
              <Button asChild className="w-full" variant="outline">
                <Link to="/lessons">
                  Go to Lessons
                  <FaBookOpen className="ml-2 h-4 w-4" />
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

        <p className="text-center text-sm text-muted-foreground" style={learnXRFontStyle}>
          <span className="text-foreground">Learn</span>
          <span className="text-primary">XR</span>
          <TrademarkSymbol className="ml-0.5 inline" />
          {' '}– Associate
        </p>
      </div>
    </div>
  );
};

export default AssociateDashboard;
