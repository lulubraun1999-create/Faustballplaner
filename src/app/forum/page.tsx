import { forumTopics } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

export default function ForumPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">Fan Forum</h1>
          <p className="text-muted-foreground mt-2">Discuss all things Werkself with fellow fans.</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Pencil className="mr-2 h-4 w-4" />
            New Topic
        </Button>
      </header>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">Topic</TableHead>
                <TableHead className="text-center">Replies</TableHead>
                <TableHead className="text-right">Last Post</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forumTopics.map((topic) => (
                <TableRow key={topic.id} className="cursor-pointer">
                  <TableCell>
                    <div className="font-medium">{topic.title}</div>
                    <div className="text-sm text-muted-foreground">by {topic.author}</div>
                  </TableCell>
                  <TableCell className="text-center">{topic.replies}</TableCell>
                  <TableCell className="text-right">{topic.lastPost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
