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
  lead_status: string;
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

  // 🔥 FETCH + GROUP
  async function loadLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const grouped: Record<string, Lead[]> = {
      new: [],
      contacted: [],
      booked: [],
      closed: [],
    };

    data.forEach((lead) => {
      const status = lead.lead_status || "new";
      if (grouped[status]) {
        grouped[status].push(lead);
      }
    });

    setLeads(grouped);
  }

  // 🔥 DRAG HANDLER
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceCol = result.source.droppableId;
    const destCol = result.destination.droppableId;

    if (sourceCol === destCol) return;

    const sourceItems = Array.from(leads[sourceCol]);
    const destItems = Array.from(leads[destCol]);

    const [movedItem] = sourceItems.splice(result.source.index, 1);

    movedItem.lead_status = destCol;

    destItems.splice(result.destination.index, 0, movedItem);

    const newState = {
      ...leads,
      [sourceCol]: sourceItems,
      [destCol]: destItems,
    };

    setLeads(newState);

    // 🔥 UPDATE DB
    await supabase
      .from("leads")
      .update({ lead_status: destCol })
      .eq("id", movedItem.id);
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
                    {/* COLUMN TITLE */}
                    <h3 className="mb-3 capitalize font-medium text-sm md:text-base">
                      {status}
                    </h3>

                    {/* LEADS */}
                    <div className="space-y-2">
                      {leads[status].map((lead, index) => (
                        <Draggable
                          key={lead.id}
                          draggableId={lead.id}
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