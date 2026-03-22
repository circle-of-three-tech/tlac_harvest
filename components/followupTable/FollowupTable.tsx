'use client';

import { useState } from "react";
import { format } from "date-fns";
import { Edit2 } from "lucide-react";
import LeadsModal from "./LeadsModal";
import EditFollowupModal from "./EditFollowupModal";

const FollowupTable = ({ followups: initialFollowups }: { followups: any[] }) => {
    const [followups, setFollowups] = useState(initialFollowups);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFollowup, setEditingFollowup] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const openLeadsModal = (user: any) => {
      setSelectedUser(user);
      setIsModalOpen(true);
    };

    const closeLeadsModal = () => {
      setIsModalOpen(false);
      setSelectedUser(null);
    };

    const openEditModal = (e: React.MouseEvent, user: any) => {
      e.stopPropagation();
      setEditingFollowup(user);
      setShowEditModal(true);
    };

    const closeEditModal = () => {
      setShowEditModal(false);
      setEditingFollowup(null);
    };

    const handleEditSuccess = (updatedFollowup: any) => {
      // Update the followup in the list
      setFollowups(followups.map(f => f.id === updatedFollowup.id ? updatedFollowup : f));
    };

    const handleDeleteSuccess = (deletedId: string) => {
      // Remove the followup from the list
      setFollowups(followups.filter(f => f.id !== deletedId));
    };

    const truncate = (str, max) => str.length > max ? str.slice(0, max) + "..." : str;
 
    return (
      <>
        {/* Desktop Table View */}
        <div className="hidden lg:block w-full overflow-x-auto">
            <table className="harvest-table min-w-full bg-white">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Assigned Leads</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {followups.map(user => (
                <tr 
                  key={user.id}
                  className="hover:bg-blue-50 transition"
                >
                  <td
                    onClick={() => openLeadsModal(user)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {user.name[0]}
                      </div>
                      <span className="font-medium text-slate-900">{user.gender === "MALE"? "Bro" : "Sis"}{" "}{user.name}</span>
                    </div>
                  </td>
                  <td onClick={() => openLeadsModal(user)} className="text-slate-600 cursor-pointer">{user.email}</td>
                  <td onClick={() => openLeadsModal(user)} className="text-slate-600 cursor-pointer">{user.phone}</td>
                  <td onClick={() => openLeadsModal(user)} className="cursor-pointer">
                    <span className="badge bg-blue-100 text-blue-700">
                      {user._count?.assignedLeads ?? 0} leads
                    </span>
                  </td>
                  <td onClick={() => openLeadsModal(user)} className="text-slate-400 text-sm cursor-pointer">{format(new Date(user.createdAt), "MMM d, yyyy")}</td>
                  <td>
                    <button
                      onClick={(e) => openEditModal(e, user)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-blue-700 hover:bg-blue-100 transition text-sm font-medium"
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
          {followups.map((user) => (
            <div
              key={user.id}
              className="p-4 bg-white shadow-md hover:shadow-lg border border-blue-100 rounded-xl transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div
                  onClick={() => openLeadsModal(user)}
                  className="relative flex items-center gap-3 flex-1 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {user.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{user.gender === "MALE"? "Bro" : "Sis"}{" "}{truncate(user.name, 10)}</div>
                    <div className="text-xs text-slate-400 truncate">{user.email}</div>
                  </div>
                </div>

                <button
                  onClick={(e) => openEditModal(e, user)}
                  className="absolute top-[1rem] right-[1rem] flex-shrink-0 p-2 rounded-lg hover:bg-blue-100 transition"
                >
                  <Edit2 className="w-4 h-4 text-blue-700" />
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between cursor-pointer" onClick={() => openLeadsModal(user)}>
                  <span className="text-slate-500">Assigned Leads</span>
                  <span className="badge bg-blue-100 text-blue-700">
                    {user._count?.assignedLeads ?? 0} leads
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-100 cursor-pointer" onClick={() => openLeadsModal(user)}>
                  <span className="text-slate-500">Joined</span>
                  <span className="text-slate-400 text-xs">{format(new Date(user.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Leads Modal */}
        <LeadsModal 
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={closeLeadsModal}
        />

        {/* Edit Followup Modal */}
        <EditFollowupModal
          isOpen={showEditModal}
          onClose={closeEditModal}
          followupMember={editingFollowup}
          onSuccess={handleEditSuccess}
          onDelete={handleDeleteSuccess}
        />
      </>
    )
}

export default FollowupTable;