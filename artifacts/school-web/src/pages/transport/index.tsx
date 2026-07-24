import { useState } from "react";
import {
  useListTransportRoutes,
  useCreateTransportRoute,
  useDeleteTransportRoute,
  useCreateTransportStop,
  useDeleteTransportStop,
  useListTransportAssignments,
  useCreateTransportAssignment,
  useDeleteTransportAssignment,
  useListStudents,
  getListTransportRoutesQueryKey,
  getListTransportAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Bus, Plus, Trash2, MapPin } from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import { useSelectedChild } from "@/lib/selected-child-context";

export default function TransportPage() {
  const { user } = useAppAuth();
  return user?.role === "admin" ? <ManageTransport /> : <MyTransport />;
}

function ManageTransport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: routes, isLoading: loadingRoutes } = useListTransportRoutes();
  const { data: assignments } = useListTransportAssignments({}, { query: { queryKey: getListTransportAssignmentsQueryKey({}) } });
  const { data: students } = useListStudents({});

  const createRoute = useCreateTransportRoute();
  const deleteRoute = useDeleteTransportRoute();
  const createStop = useCreateTransportStop();
  const deleteStop = useDeleteTransportStop();
  const createAssignment = useCreateTransportAssignment();
  const deleteAssignment = useDeleteTransportAssignment();

  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeDescription, setRouteDescription] = useState("");

  const [stopDialogRouteId, setStopDialogRouteId] = useState<number | null>(null);
  const [stopName, setStopName] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignStopId, setAssignStopId] = useState("");

  const invalidateRoutes = () => queryClient.invalidateQueries({ queryKey: getListTransportRoutesQueryKey() });
  const invalidateAssignments = () => queryClient.invalidateQueries({ queryKey: getListTransportAssignmentsQueryKey({}) });

  const handleCreateRoute = () => {
    if (!routeName.trim()) return;
    createRoute.mutate(
      { data: { name: routeName.trim(), description: routeDescription.trim() || null } },
      {
        onSuccess: () => {
          invalidateRoutes();
          setRouteDialogOpen(false);
          setRouteName("");
          setRouteDescription("");
          toast({ title: "Route added" });
        },
        onError: (err: any) => toast({ title: "Failed to add route", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDeleteRoute = (id: number) => {
    deleteRoute.mutate({ id }, { onSuccess: () => { invalidateRoutes(); toast({ title: "Route removed" }); } });
  };

  const handleAddStop = () => {
    if (!stopDialogRouteId || !stopName.trim()) return;
    createStop.mutate(
      { id: stopDialogRouteId, data: { name: stopName.trim(), pickupTime: pickupTime || null, dropTime: dropTime || null } },
      {
        onSuccess: () => {
          invalidateRoutes();
          setStopDialogRouteId(null);
          setStopName("");
          setPickupTime("");
          setDropTime("");
          toast({ title: "Stop added" });
        },
        onError: (err: any) => toast({ title: "Failed to add stop", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDeleteStop = (id: number) => {
    deleteStop.mutate({ id }, { onSuccess: () => { invalidateRoutes(); toast({ title: "Stop removed" }); } });
  };

  const handleAssign = () => {
    if (!assignStudentId || !assignRouteId || !assignStopId) return;
    createAssignment.mutate(
      { data: { studentId: Number(assignStudentId), routeId: Number(assignRouteId), stopId: Number(assignStopId) } },
      {
        onSuccess: () => {
          invalidateAssignments();
          setAssignDialogOpen(false);
          setAssignStudentId("");
          setAssignRouteId("");
          setAssignStopId("");
          toast({ title: "Student assigned" });
        },
        onError: (err: any) => toast({ title: "Failed to assign student", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleUnassign = (studentId: number) => {
    deleteAssignment.mutate({ studentId }, { onSuccess: () => { invalidateAssignments(); toast({ title: "Assignment removed" }); } });
  };

  const selectedRouteStops = routes?.find((r) => r.id === Number(assignRouteId))?.stops ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
          <p className="text-muted-foreground mt-1">Manage bus routes, stops, and student assignments</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Assign Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Student to Route</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                    <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                    <SelectContent>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.user?.name} ({s.rollNo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Route</Label>
                  <Select value={assignRouteId} onValueChange={(v) => { setAssignRouteId(v); setAssignStopId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Choose a route" /></SelectTrigger>
                    <SelectContent>
                      {routes?.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stop</Label>
                  <Select value={assignStopId} onValueChange={setAssignStopId} disabled={!assignRouteId}>
                    <SelectTrigger><SelectValue placeholder="Choose a stop" /></SelectTrigger>
                    <SelectContent>
                      {selectedRouteStops.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAssign} disabled={createAssignment.isPending}>Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Add Route</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Route</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Route name</Label>
                  <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Route 1 - North" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Input value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateRoute} disabled={createRoute.isPending}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadingRoutes ? (
        <div className="space-y-4"><Skeleton className="h-32 w-full rounded-xl" /></div>
      ) : routes && routes.length > 0 ? (
        <div className="space-y-4">
          {routes.map((route) => {
            const routeAssignments = assignments?.filter((a) => a.routeId === route.id) ?? [];
            return (
              <Card key={route.id} className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Bus className="w-4 h-4" /> {route.name}</CardTitle>
                    {route.description && <CardDescription>{route.description}</CardDescription>}
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={stopDialogRouteId === route.id} onOpenChange={(open) => setStopDialogRouteId(open ? route.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Add Stop</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add Stop to {route.name}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label>Stop name</Label>
                            <Input value={stopName} onChange={(e) => setStopName(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label>Pickup time</Label>
                              <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Drop time</Label>
                              <Input type="time" value={dropTime} onChange={(e) => setDropTime(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddStop} disabled={createStop.isPending}>Add</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRoute(route.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!route.stops || route.stops.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No stops added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {route.stops.map((stop) => (
                        <div key={stop.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{stop.name}</span>
                          {(stop.pickupTime || stop.dropTime) && (
                            <span className="text-xs text-muted-foreground">
                              {stop.pickupTime && `Pickup ${stop.pickupTime}`}
                              {stop.pickupTime && stop.dropTime && " · "}
                              {stop.dropTime && `Drop ${stop.dropTime}`}
                            </span>
                          )}
                          <button onClick={() => handleDeleteStop(stop.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {routeAssignments.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{routeAssignments.length} student(s) assigned</p>
                      <div className="flex flex-wrap gap-2">
                        {routeAssignments.map((a) => (
                          <Badge key={a.id} variant="secondary" className="gap-1.5">
                            {a.student?.user?.name} · {a.stop?.name}
                            <button onClick={() => handleUnassign(a.studentId)} className="ml-1 hover:text-destructive">×</button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center text-muted-foreground border-dashed">No routes added yet.</Card>
      )}
    </div>
  );
}

function MyTransport() {
  const { selectedChildId } = useSelectedChild();
  const params = selectedChildId ? { studentId: selectedChildId } : {};
  const { data: assignments, isLoading } = useListTransportAssignments(params, { query: { queryKey: getListTransportAssignmentsQueryKey(params) } });
  const assignment = assignments?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
        <p className="text-muted-foreground mt-1">Your assigned bus route and stop</p>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardContent className="p-6">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !assignment ? (
            <div className="text-center text-muted-foreground py-6">
              <Bus className="w-10 h-10 mx-auto mb-3 opacity-50" />
              No transport route assigned yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bus className="w-5 h-5 text-primary" />
                <p className="text-lg font-semibold">{assignment.route?.name}</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <p>{assignment.stop?.name}</p>
              </div>
              {(assignment.stop?.pickupTime || assignment.stop?.dropTime) && (
                <div className="flex gap-4 text-sm">
                  {assignment.stop?.pickupTime && <span>Pickup: <strong>{assignment.stop.pickupTime}</strong></span>}
                  {assignment.stop?.dropTime && <span>Drop: <strong>{assignment.stop.dropTime}</strong></span>}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
