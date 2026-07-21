import { useState } from "react";
import {
  useListFeePayments,
  useListFeeStructures,
  useMarkFeePaid,
  useCreateFeeStructure,
  useListClasses,
  getListFeePaymentsQueryKey,
  getGetFeeOverviewQueryKey,
  getListFeeStructuresQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { Check, Plus, Zap, CreditCard } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function generatePayments(feeStructureId: number) {
  const res = await fetch(`${BASE_URL}/api/fee-structures/${feeStructureId}/generate-payments`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ created: number; skipped: number }>;
}

async function payFee(feePaymentId: number): Promise<{ paymentUrl: string }> {
  const res = await fetch(`${BASE_URL}/api/fee-payments/${feePaymentId}/pay`, {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not start payment");
  return data;
}

export default function FeesPage() {
  const { user } = useAppAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees & Payments</h1>
          <p className="text-muted-foreground mt-1">
            {user.role === "admin"
              ? "Manage fee collections across all classes"
              : "View your fee payment status"}
          </p>
        </div>
        {user.role === "admin" && (
          <div className="flex gap-2">
            <GeneratePaymentsDialog />
            <AddFeeStructureDialog />
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {user.role === "admin" ? <AdminFeeTable /> : <StudentFeeTable />}
      </div>
    </div>
  );
}

// ── Generate Payments Dialog ──────────────────────────────────────────────────

function GeneratePaymentsDialog() {
  const [open, setOpen] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { data: structures, isLoading } = useListFeeStructures();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!selectedStructureId) return;
    setLoading(true);
    try {
      const result = await generatePayments(parseInt(selectedStructureId));
      queryClient.invalidateQueries({ queryKey: getListFeePaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetFeeOverviewQueryKey() });
      toast({
        title: "Payments generated",
        description: `${result.created} new records created, ${result.skipped} already existed.`,
      });
      setOpen(false);
      setSelectedStructureId("");
    } catch {
      toast({ title: "Failed to generate payments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selected = structures?.find((s) => String(s.id) === selectedStructureId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Zap className="w-4 h-4 mr-2" />
          Generate Payments
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Fee Payments for Class</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Pick a fee structure — this will create a pending payment record for every
            student in that class. Students who already have a record are skipped.
          </p>
          <div className="space-y-2">
            <Label>Fee Structure</Label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedStructureId} onValueChange={setSelectedStructureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a fee structure…" />
                </SelectTrigger>
                <SelectContent>
                  {structures?.map((fs) => (
                    <SelectItem key={fs.id} value={String(fs.id)}>
                      {fs.class?.name} {fs.class?.section} — {fs.term} (₹{fs.amount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {selected && (
            <div className="rounded-lg bg-muted/50 border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{selected.class?.name} {selected.class?.section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term</span>
                <span className="font-medium">{selected.term}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">₹{selected.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">
                  {format(new Date(selected.dueDate), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!selectedStructureId || loading}>
            {loading ? "Generating…" : "Generate Payments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Fee Structure Dialog ──────────────────────────────────────────────────

function AddFeeStructureDialog() {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");
  const [dueDate, setDueDate] = useState("");
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const createStructure = useCreateFeeStructure();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!classId || !amount || !term || !dueDate) return;
    createStructure.mutate(
      { data: { classId: parseInt(classId), amount: parseFloat(amount), term, dueDate } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() });
          toast({ title: "Fee structure created" });
          setOpen(false);
          setClassId(""); setAmount(""); setTerm(""); setDueDate("");
        },
        onError: () => {
          toast({ title: "Failed to create fee structure", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Fee Structure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Fee Structure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Class</Label>
            {classesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class…" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Term Name</Label>
            <Input
              placeholder="e.g. Term 2 2026"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                placeholder="12000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!classId || !amount || !term || !dueDate || createStructure.isPending}
          >
            {createStructure.isPending ? "Creating…" : "Create Structure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Admin Table ───────────────────────────────────────────────────────────────

function AdminFeeTable() {
  const [filter, setFilter] = useState<"pending" | "paid" | undefined>(undefined);
  const { data: payments, isLoading } = useListFeePayments(filter ? { status: filter } : {});
  const markPaid = useMarkFeePaid();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleMarkPaid = (id: number) => {
    markPaid.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFeePaymentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFeeOverviewQueryKey() });
          toast({ title: "Marked as paid" });
        },
      }
    );
  };

  return (
    <>
      <div className="p-4 border-b flex gap-2 bg-muted/30">
        <Button variant={filter === undefined ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(undefined)}>All</Button>
        <Button variant={filter === "pending" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("pending")}>Pending</Button>
        <Button variant={filter === "paid" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("paid")}>Paid</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Student</TableHead>
            <TableHead>Term</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right pr-6">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : payments?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No records found. Add a fee structure and generate payments to get started.
              </TableCell>
            </TableRow>
          ) : (
            payments?.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="pl-6 font-medium">
                  <div>{payment.student?.user?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Roll {payment.student?.rollNo}
                  </div>
                </TableCell>
                <TableCell>{payment.feeStructure?.term}</TableCell>
                <TableCell className="font-medium">₹{payment.feeStructure?.amount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.feeStructure && format(new Date(payment.feeStructure.dueDate), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {payment.status === "paid" ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Paid</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right pr-6">
                  {payment.status === "pending" && (
                    <Button size="sm" onClick={() => handleMarkPaid(payment.id)} disabled={markPaid.isPending}>
                      <Check className="w-4 h-4 mr-2" /> Mark Paid
                    </Button>
                  )}
                  {payment.status === "paid" && payment.paidOn && (
                    <span className="text-xs text-muted-foreground">
                      Paid on {format(new Date(payment.paidOn), "MMM d")}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

// ── Student Table ─────────────────────────────────────────────────────────────

function StudentFeeTable() {
  const { data: payments, isLoading } = useListFeePayments();
  const { toast } = useToast();
  const [payingId, setPayingId] = useState<number | null>(null);

  const handlePay = async (id: number) => {
    setPayingId(id);
    try {
      const { paymentUrl } = await payFee(id);
      window.location.href = paymentUrl;
    } catch (err: any) {
      toast({ title: err?.message || "Could not start payment", variant: "destructive" });
    } finally {
      setPayingId(null);
    }
  };

  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-6">Term</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="text-right pr-6">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="pl-6"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="text-right pr-6"><Skeleton className="h-6 w-16 rounded-full ml-auto" /></TableCell>
            </TableRow>
          ))
        ) : payments?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
              No fee records found.
            </TableCell>
          </TableRow>
        ) : (
          payments?.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="pl-6 font-medium">{payment.feeStructure?.term}</TableCell>
              <TableCell className="font-bold">₹{payment.feeStructure?.amount}</TableCell>
              <TableCell className="text-muted-foreground">
                {payment.feeStructure && format(new Date(payment.feeStructure.dueDate), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right pr-6">
                {payment.status === "paid" ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                    Paid on {payment.paidOn ? format(new Date(payment.paidOn), "MMM d") : ""}
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => handlePay(payment.id)} disabled={payingId === payment.id}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    {payingId === payment.id ? "Starting..." : "Pay Now"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
