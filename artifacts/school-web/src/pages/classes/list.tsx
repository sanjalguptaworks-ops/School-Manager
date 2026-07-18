import { useState } from "react";
import { useListClasses, useCreateClass, getListClassesQueryKey, useDeleteClass } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, BookOpen, Trash2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ClassesList() {
  const [search, setSearch] = useState("");
  const { data: classes, isLoading } = useListClasses();
  
  const filteredClasses = classes?.filter(c => 
    search === "" || 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.section.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">Manage school classes and sections</p>
        </div>
        <AddClassDialog />
      </div>

      <div className="flex bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by class name or section..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full bg-background border-border/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 shadow-sm">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))
        ) : filteredClasses?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
            No classes found.
          </div>
        ) : (
          filteredClasses?.map((cls) => (
            <Link key={cls.id} href={`/classes/${cls.id}`}>
              <div className="group rounded-xl border bg-card hover:bg-muted/30 hover:border-primary/30 p-6 shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">{cls.name} <span className="text-muted-foreground font-normal">Section {cls.section}</span></h3>
                <p className="text-muted-foreground flex items-center gap-2 text-sm mt-4">
                  <Users className="w-4 h-4" />
                  {cls.studentCount || 0} Students
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  section: z.string().min(1, "Section is required"),
});

function AddClassDialog() {
  const [open, setOpen] = useState(false);
  const createClass = useCreateClass();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", section: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createClass.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
          setOpen(false);
          form.reset();
          toast({ title: "Class created" });
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-sm"><Plus className="w-4 h-4 mr-2" /> Add Class</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Class Name (e.g. Grade 10)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="section" render={({ field }) => (
              <FormItem><FormLabel>Section (e.g. A)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createClass.isPending}>Save Class</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}