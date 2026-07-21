import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";

type Group = { id:number; name:string; description:string|null; memberCount:number; isMember:boolean; role:string|null };
export default function Groups({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation(); const queryClient = useQueryClient(); const [name,setName]=useState(""); const [description,setDescription]=useState(""); const [creating,setCreating]=useState(false);
  const groups = useQuery({ queryKey:["groups"], queryFn:()=>api<Group[]>("/groups") });
  const create = useMutation({ mutationFn:()=>api<Group>("/groups",{method:"POST",body:JSON.stringify({name,description})}), onSuccess:g=>{queryClient.invalidateQueries({queryKey:["groups"]}); navigate(`/groups/${g.id}`);} });
  return <div className={embedded ? "space-y-6" : "max-w-5xl mx-auto space-y-6"}><div className="flex justify-between items-end"><div><h2 className={embedded ? "text-xl font-display font-bold" : "text-3xl font-display font-bold"}>Groups</h2><p className="text-sm text-muted-foreground mt-1">Private spaces for bettors to talk and collaborate.</p></div><Button onClick={()=>setCreating(v=>!v)}><Plus className="w-4 h-4 mr-2"/>New group</Button></div>
    {creating&&<Card><CardContent className="p-5"><form onSubmit={e=>{e.preventDefault();create.mutate();}} className="grid md:grid-cols-2 gap-3"><Input placeholder="Group name" value={name} onChange={e=>setName(e.target.value)} required/><Input placeholder="Short description" value={description} onChange={e=>setDescription(e.target.value)}/><Button disabled={create.isPending} className="md:col-span-2">Create group</Button></form></CardContent></Card>}
    <div className="grid md:grid-cols-2 gap-4">{groups.data?.map(g=><button key={g.id} onClick={()=>navigate(`/groups/${g.id}`)} className="text-left"><Card className="hover:border-primary/50 transition-colors h-full"><CardContent className="p-5"><div className="flex justify-between"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary"/></div>{g.isMember&&<span className="text-xs text-primary font-medium">Member</span>}</div><h2 className="font-display font-semibold text-lg mt-4">{g.name}</h2><p className="text-sm text-muted-foreground mt-1">{g.description||"No description yet."}</p><p className="text-xs text-muted-foreground mt-4">{g.memberCount} {g.memberCount===1?"member":"members"}</p></CardContent></Card></button>)}</div>
    {!groups.isLoading&&!groups.data?.length&&<div className="text-center py-20 text-muted-foreground">No groups yet. Create the first one.</div>}
  </div>;
}
