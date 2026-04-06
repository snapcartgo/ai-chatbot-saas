"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

type Lead = {
  id: string;
  name: string;
  phone: string;
  service: string;
  leads_status?: string;
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

  // 🔥 HYBRID LOAD (leads + conversations)
  async function loadLeads() {
    // 1️⃣ Fetch leads (booked users)
    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("*");

    if (leadsError) {
      console.error(leadsError);
      return;
    }

    // 2️⃣ Fetch conversations (all users)
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

    // ✅ Step 1: Add booked leads
    leadsData?.forEach((lead) => {
      grouped.booked.push({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        service: lead.service,
        leads_status: "booked",
      });
    });

    // ✅ Step 2: Add conversations (not yet leads)
    convoData?.forEach((conv: any) => {
      const alreadyLead = leadsData?.find(
        (l) => l.phone === conv.phone
      );

      if (!alreadyLead) {
        // 🔹 If user has some info → contacted
        if (conv.name || conv.phone) {
          grouped.contacted.push({
            id: conv.id,
            name: conv.name || "Unknown",
            phone: conv.phone || "-",
            service: "From Chat",
          });
        } else {
          // 🔹 Just started chat → new
          grouped.new.push({
            id: conv.id,
            name: "New Visitor",
            phone: "-",
            service: "Chat Started",
          });
        }
      }
    });

    setLeads(grouped);
  }

  // 🔥 DRAG HANDLER (only for real leads)
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

    // ⚠️ Only update DB if it's from leads table (booked items)
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
      <h1 className="text-xl md:text-2xl font-semibold mb-6">
        Lead Pipeline
      </h1>

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
                        <Draggable
                          key={lead.id}
                          draggableId={lead.id.toString()}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-white p-3 rounded-md shadow-sm cursor-grab"
                            >
                              <div className="font-semibold text-sm">
                                {lead.name}
                              </div>

                              <div className="text-xs text-gray-600">
                                {lead.phone}
                              </div>

                              <div className="text-xs text-gray-500">
                                {lead.service}
                              </div>

                              {/* 🔥 Badge */}
                              {lead.phone === "-" && (
                                <div className="text-[10px] text-blue-500 mt-1">
                                  Chat User
                                </div>
                              )}
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