'use client';

import { useState } from "react";
import { format } from "date-fns";
import { Edit2, Trash2 } from "lucide-react";
import AddedLeadsModal from "./AddedLeadsModal";
import EditEvangelistModal from "./EditEvangelistModal";

const EvangelistTable = ({ evangelists: initialEvangelists }: { evangelists: any[] }) => {
  const [evangelists, setEvangelists] = useState(initialEvangelists);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvangelistId, setEditingEvangelistId] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const openLeadsModal = (user: any) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeLeadsModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const openEditModal = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setEditingEvangelistId(userId);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingEvangelistId(null);
  };

  const handleEditSuccess = (updatedEvangelist: any) => {
    // Update the evangelist in the list
    setEvangelists(evangelists.map(e => e.id === updatedEvangelist.id ? updatedEvangelist : e));
  };

  const handleDeleteSuccess = (deletedId: string) => {
    // Remove the evangelist from the list
    setEvangelists(evangelists.filter(e => e.id !== deletedId));
  };

   const truncate = (str: string, max: number): string => str.length > max ? str.slice(0, max) + "..." : str;
 

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block w-full overflow-x-auto">
      <table className="harvest-table min-w-full bg-white shadow-md rounded-xl border border-slate-200">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Leads Added</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {evangelists.map((user) => (
          <tr 
            key={user.id}
            className="hover:bg-harvest-50 transition"
          >
            <td
              onClick={() => openLeadsModal(user)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-harvest-100 flex items-center justify-center text-harvest-700 font-bold text-sm">
                  {user.name?.[0] ?? "?"}
                </div>
                <span className="font-medium text-earth-900"> {user.gender === "MALE"? "Bro" : "Sis"}{" "}{user.name}</span>
              </div>
            </td>
            <td onClick={() => openLeadsModal(user)} className="text-earth-600 cursor-pointer">{user.email}</td>
            <td onClick={() => openLeadsModal(user)} className="text-earth-600 cursor-pointer">{user.phone}</td>
            <td onClick={() => openLeadsModal(user)} className="cursor-pointer">
              <span className="badge bg-harvest-100 text-harvest-700">
                {user._count?.addedLeads ?? 0} leads
              </span>
            </td>
            <td onClick={() => openLeadsModal(user)} className="text-earth-400 text-sm cursor-pointer">
              {user.createdAt && !isNaN(new Date(user.createdAt).getTime()) ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
            </td>
            <td>
              <button
                onClick={(e) => openEditModal(e, user.id)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-harvest-700 hover:bg-harvest-100 transition text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
      </div>

      {/* Mobile/Tablet List View */}
      <div className="lg:hidden space-y-3">
        {evangelists.map((user) => (
          <div
            key={user.id}
            className="p-4 bg-white shadow-md hover:shadow-lg border border-slate-200 rounded-xl hover:border-harvest-300 hover:bg-harvest-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div
                onClick={() => openLeadsModal(user)}
                className="flex items-center gap-3 flex-1 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-harvest-100 flex items-center justify-center text-harvest-700 font-bold text-sm flex-shrink-0">
                  {user.name?.[0] ?? "?"}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-earth-900 truncate">{user.gender === "MALE"? "Bro" : "Sis"}{" "}{truncate(user.name, 10)}</div>
                  <div className="text-xs text-slate-400 truncate">{user.email}</div>
                </div>
              </div>
              <button
                onClick={(e) => openEditModal(e, user.id)}
                className="flex-shrink-0 p-2 rounded-lg hover:bg-harvest-100 transition"
              >
                <Edit2 className="w-4 h-4 text-harvest-700" />
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between cursor-pointer" onClick={() => openLeadsModal(user)}>
                <span className="text-slate-500">Leads Added</span>
                <span className="badge bg-slate-100 text-harvest-700">
                  {user._count?.addedLeads ?? 0} leads
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-harvest-100 cursor-pointer" onClick={() => openLeadsModal(user)}>
                <span className="text-slate-500">Joined</span>
                <span className="text-slate-400 text-xs">{user.createdAt && !isNaN(new Date(user.createdAt).getTime()) ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Added Leads Modal */}
      <AddedLeadsModal 
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={closeLeadsModal}
      />

      {/* Edit Evangelist Modal */}
      <EditEvangelistModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        evangelistId={editingEvangelistId}
        onSuccess={handleEditSuccess}
        onDelete={handleDeleteSuccess}
      />
    </>
  );
};

export default EvangelistTable;