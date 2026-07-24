import { useState } from "react";
import {
  useListLibraryBooks,
  useCreateLibraryBook,
  useUpdateLibraryBook,
  useDeleteLibraryBook,
  useListLibraryLoans,
  useCreateLibraryLoan,
  useReturnLibraryLoan,
  useListStudents,
  getListLibraryBooksQueryKey,
  getListLibraryLoansQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BookOpen, Plus, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import { useSelectedChild } from "@/lib/selected-child-context";

export default function LibraryPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  return canManage ? <ManageLibrary /> : <MyLoans />;
}

function ManageLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: books, isLoading: loadingBooks } = useListLibraryBooks();
  const { data: loans, isLoading: loadingLoans } = useListLibraryLoans({}, { query: { queryKey: getListLibraryLoansQueryKey({}) } });
  const { data: students } = useListStudents({});

  const createBook = useCreateLibraryBook();
  const updateBook = useUpdateLibraryBook();
  const deleteBook = useDeleteLibraryBook();
  const createLoan = useCreateLibraryLoan();
  const returnLoan = useReturnLibraryLoan();

  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<{ id: number; title: string; author: string; isbn: string | null; totalCopies: number } | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [totalCopies, setTotalCopies] = useState("1");

  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loanBookId, setLoanBookId] = useState<string>("");
  const [loanStudentId, setLoanStudentId] = useState<string>("");
  const [loanDueDate, setLoanDueDate] = useState(format(new Date(Date.now() + 14 * 86400000), "yyyy-MM-dd"));

  const resetBookForm = () => {
    setEditingBook(null);
    setTitle("");
    setAuthor("");
    setIsbn("");
    setTotalCopies("1");
  };

  const openEditBook = (book: { id: number; title: string; author: string; isbn: string | null; totalCopies: number }) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn || "");
    setTotalCopies(String(book.totalCopies));
    setBookDialogOpen(true);
  };

  const invalidateBooks = () => queryClient.invalidateQueries({ queryKey: getListLibraryBooksQueryKey() });
  const invalidateLoans = () => queryClient.invalidateQueries({ queryKey: getListLibraryLoansQueryKey({}) });

  const handleSaveBook = () => {
    if (!title.trim() || !author.trim()) return;
    const data = { title: title.trim(), author: author.trim(), isbn: isbn.trim() || null, totalCopies: Number(totalCopies) || 1 };

    if (editingBook) {
      updateBook.mutate(
        { id: editingBook.id, data },
        {
          onSuccess: () => {
            invalidateBooks();
            setBookDialogOpen(false);
            resetBookForm();
            toast({ title: "Book updated" });
          },
          onError: (err: any) => toast({ title: "Failed to update book", description: err.message, variant: "destructive" }),
        },
      );
    } else {
      createBook.mutate(
        { data },
        {
          onSuccess: () => {
            invalidateBooks();
            setBookDialogOpen(false);
            resetBookForm();
            toast({ title: "Book added" });
          },
          onError: (err: any) => toast({ title: "Failed to add book", description: err.message, variant: "destructive" }),
        },
      );
    }
  };

  const handleDeleteBook = (id: number) => {
    deleteBook.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateBooks();
          toast({ title: "Book removed" });
        },
        onError: (err: any) => toast({ title: "Failed to remove book", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleIssueLoan = () => {
    if (!loanBookId || !loanStudentId || !loanDueDate) return;
    createLoan.mutate(
      { data: { bookId: Number(loanBookId), studentId: Number(loanStudentId), dueDate: loanDueDate } },
      {
        onSuccess: () => {
          invalidateLoans();
          invalidateBooks();
          setLoanDialogOpen(false);
          setLoanBookId("");
          setLoanStudentId("");
          toast({ title: "Book issued" });
        },
        onError: (err: any) => toast({ title: "Failed to issue book", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleReturn = (id: number) => {
    returnLoan.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          invalidateLoans();
          invalidateBooks();
          toast({ title: "Book marked returned" });
        },
        onError: (err: any) => toast({ title: "Failed to mark returned", description: err.message, variant: "destructive" }),
      },
    );
  };

  const activeLoans = loans?.filter((l) => !l.returnedAt) ?? [];
  const availableBooks = books?.filter((b) => b.availableCopies > 0) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="text-muted-foreground mt-1">Manage the book catalog and student loans</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Issue Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue a Book</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Book</Label>
                  <Select value={loanBookId} onValueChange={setLoanBookId}>
                    <SelectTrigger><SelectValue placeholder="Choose a book" /></SelectTrigger>
                    <SelectContent>
                      {availableBooks.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.title} ({b.availableCopies} available)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <Select value={loanStudentId} onValueChange={setLoanStudentId}>
                    <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                    <SelectContent>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.user?.name} ({s.rollNo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input type="date" value={loanDueDate} onChange={(e) => setLoanDueDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleIssueLoan} disabled={createLoan.isPending}>Issue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={bookDialogOpen} onOpenChange={(open) => { setBookDialogOpen(open); if (!open) resetBookForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Add Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBook ? "Edit Book" : "Add Book"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Author</Label>
                  <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>ISBN (optional)</Label>
                  <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Total copies</Label>
                  <Input type="number" min={1} value={totalCopies} onChange={(e) => setTotalCopies(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveBook} disabled={createBook.isPending || updateBook.isPending}>
                  {editingBook ? "Save" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="text-lg">Catalog</CardTitle>
          <CardDescription>{books?.length ?? 0} titles</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingBooks ? (
            <div className="p-6 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : books && books.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Copies</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="pl-6 font-medium">{b.title}</TableCell>
                    <TableCell>{b.author}</TableCell>
                    <TableCell>
                      <Badge variant={b.availableCopies > 0 ? "secondary" : "destructive"}>
                        {b.availableCopies} / {b.totalCopies} available
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" onClick={() => openEditBook({ ...b, isbn: b.isbn ?? null })}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBook(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No books in the catalog yet.</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="text-lg">Active Loans</CardTitle>
          <CardDescription>{activeLoans.length} out</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingLoans ? (
            <div className="p-6"><Skeleton className="h-10 w-full" /></div>
          ) : activeLoans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Book</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLoans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6 font-medium">{l.book?.title}</TableCell>
                    <TableCell>{l.student?.user?.name} ({l.student?.rollNo})</TableCell>
                    <TableCell>{format(new Date(l.dueDate), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="outline" size="sm" onClick={() => handleReturn(l.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Returned
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No books currently out.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MyLoans() {
  const { selectedChildId } = useSelectedChild();
  const params = selectedChildId ? { studentId: selectedChildId } : {};
  const { data: loans, isLoading } = useListLibraryLoans(params, { query: { queryKey: getListLibraryLoansQueryKey(params) } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-1">Books borrowed and their due dates</p>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-10 w-full" /></div>
          ) : !loans || loans.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
              No books borrowed yet.
            </div>
          ) : (
            <div className="divide-y">
              {loans.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="font-medium">{l.book?.title}</p>
                    <p className="text-sm text-muted-foreground">{l.book?.author}</p>
                  </div>
                  <div className="text-right">
                    {l.returnedAt ? (
                      <Badge variant="secondary">Returned</Badge>
                    ) : (
                      <Badge>Due {format(new Date(l.dueDate), "MMM d, yyyy")}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
