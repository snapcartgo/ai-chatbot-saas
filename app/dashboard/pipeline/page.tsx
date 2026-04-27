"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

type Lead = {
  id: string;
  name: string;
  phone: string;
  service: string;
  leads_status?: string;
  channel?: string | null;
};

const columns = ["new", "contacted", "booked", "closed"];

export default function PipelinePage() {
  const [leads, setLeads] = useState<Record<string, Lead[]>>({
    new: [],
    contacted: [],
    booked: [],
    closed: [],
  });

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("*");

    if (leadsError) {
      console.error(leadsError);
      return;
    }

    const { data: convoData, error: convoError } = await supabase
      .from("conversations")
      .select("*");

    if (convoError) {
      console.error(convoError);
      return;
    }

    const grouped: Record<string, Lead[]> = {
      new: [],
      contacted: [],
      booked: [],
      closed: [],
    };

    leadsData?.forEach((lead) => {
      grouped.booked.push({
        id: lead.id,
        name: lead.name || "Lead",
        phone: lead.phone || lead.phone_number || "-",
        service: lead.service || "Lead",
        leads_status: "booked",
        channel: lead.channel || "website",
      });
    });

    convoData?.forEach((conv: any) => {
      const alreadyLead = leadsData?.find((l) => (l.phone || l.phone_number) === (conv.phone || conv.phone_number));

      if (!alreadyLead) {
        if (conv.name || conv.phone || conv.phone_number) {
          grouped.contacted.push({
            id: conv.id,
            name: conv.name || "Unknown",
            phone: conv.phone || conv.phone_number || "-",
            service: "From Chat",
            channel: conv.channel || "website",
          });
        } else {
          grouped.new.push({
            id: conv.id,
            name: "New Visitor",
            phone: "-",
            service: "Chat Started",
            channel: conv.channel || "website",
          });
        }
      }
    });

    setLeads(grouped);
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceCol = result.source.droppableId;
    const destCol = result.destination.droppableId;

    if (sourceCol === destCol) return;

    const sourceItems = Array.from(leads[sourceCol]);
    const destItems = Array.from(leads[destCol]);

    const [movedItem] = sourceItems.splice(result.source.index, 1);
    destItems.splice(result.destination.index, 0, movedItem);

    const newState = {
      ...leads,
      [sourceCol]: sourceItems,
      [destCol]: destItems,
    };

    setLeads(newState);

    if (movedItem.phone !== "-") {
      const { error } = await supabase
        .from("leads")
        .update({ leads_status: destCol })
        .eq("id", movedItem.id);

      if (error) {
        console.error("Update error:", error);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 w-full">
      <h1 className="text-xl md:text-2xl font-semibold mb-6">Lead Pipeline</h1>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-[800px] md:grid md:grid-cols-4">
            {columns.map((status) => (
              <Droppable droppableId={status} key={status}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-gray-100 p-3 rounded-lg min-h-[400px] w-[250px] md:w-auto"
                  >
                    <h3 className="mb-3 capitalize font-medium text-sm md:text-base">
                      {status}
                    </h3>

                    <div className="space-y-2">
                      {leads[status].map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id.toString()} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-white p-3 rounded-md shadow-sm cursor-grab"
                            >
                              <div className="font-semibold text-sm">{lead.name}</div>
                              <div className="text-xs text-gray-600">{lead.phone}</div>
                              <div className="text-xs text-gray-500">{lead.service}</div>
                              <div className="text-[10px] text-blue-500 mt-1">
                                {lead.channel || "website"}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
