/**
 * School Management Component
 * 
 * Allows admins and superadmins to:
 * - Create new schools
 * - View all schools
 * - Update school information
 * - Assign principals to schools
 * 
 * Access: Admin/Superadmin only
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  createSchool,
  updateSchool,
  getAllSchools,
} from '../../services/schoolManagementService';
import type { School } from '../../types/lms';
import { FaPlus, FaSchool, FaEdit, FaUsers, FaMapMarkerAlt, FaPhone, FaGlobe, FaGraduationCap, FaBuilding, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';

const SchoolManagement = () => {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [newSchoolData, setNewSchoolData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactPerson: '',
    contactPhone: '',
    website: '',
    boardAffiliation: '',
    establishedYear: '',
    schoolType: '',
  });

  useEffect(() => {
    if (!profile) return;

    // Only admin/superadmin can access
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      setLoading(false);
      return;
    }

    // Load schools
    const loadSchools = async () => {
      const schoolsData = await getAllSchools(profile);
      setSchools(schoolsData);
      setLoading(false);
    };

    loadSchools();

    // Load all users (for assigning principals)
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    });

    return () => {
      unsubscribeUsers();
    };
  }, [profile]);

  const handleCreateSchool = async () => {
    if (!profile) return;

    if (!newSchoolData.name.trim()) {
      toast.error('School name is required');
      return;
    }

    const schoolId = await createSchool(profile, newSchoolData);

    if (schoolId) {
      setShowCreateModal(false);
      setNewSchoolData({
        name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        contactPerson: '',
        contactPhone: '',
        website: '',
        boardAffiliation: '',
        establishedYear: '',
        schoolType: '',
      });
    }
  };

  const handleUpdateSchool = async () => {
    if (!profile || !selectedSchool) return;

    const success = await updateSchool(profile, selectedSchool.id, newSchoolData);
    if (success) {
      setShowEditModal(false);
      setSelectedSchool(null);
    }
  };

  const handleAssignPrincipal = async (schoolId: string, principalId: string) => {
    if (!profile) return;

    try {
      // Update school with principal_id
      await updateDoc(doc(db, 'schools', schoolId), {
        principal_id: principalId,
        updatedAt: serverTimestamp(),
      });

      // Update user with managed_school_id and set role to principal
      await updateDoc(doc(db, 'users', principalId), {
        managed_school_id: schoolId,
        school_id: schoolId, // Also set school_id for consistency
        role: 'principal',
        updatedAt: serverTimestamp(),
      });

      toast.success('Principal assigned to school successfully');
    } catch (error: any) {
      console.error('Error assigning principal:', error);
      toast.error(`Failed to assign principal: ${error.message}`);
    }
  };

  const openEditModal = (school: School) => {
    setSelectedSchool(school);
    setNewSchoolData({
      name: school.name || '',
      address: school.address || '',
      city: school.city || '',
      state: school.state || '',
      pincode: school.pincode || '',
      contactPerson: school.contactPerson || '',
      contactPhone: school.contactPhone || '',
      website: school.website || '',
      boardAffiliation: school.boardAffiliation || '',
      establishedYear: school.establishedYear || '',
      schoolType: school.schoolType || '',
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white/60">Loading school management...</p>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60">Access denied. Admin or Superadmin role required.</p>
        </div>
      </div>
    );
  }

  const principals = users.filter(u => u.role === 'principal' || u.role === 'teacher');

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <FaSchool className="text-white" />
              </div>
              School Management
            </h1>
            <p className="text-white/50">Create and manage schools, assign principals</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all flex items-center gap-2"
          >
            <FaPlus />
            Create School
          </button>
        </div>

        {/* Schools List */}
        <div className="space-y-4">
          {schools.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaSchool className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No schools created yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all"
              >
                Create Your First School
              </button>
            </div>
          ) : (
            schools.map((school) => {
              const schoolPrincipal = users.find(u => 
                (u.managed_school_id === school.id) || (school.principal_id === u.uid)
              );
              const schoolStudents = users.filter(u => u.school_id === school.id && u.role === 'student');
              const schoolTeachers = users.filter(u => u.school_id === school.id && u.role === 'teacher');

              return (
                <div
                  key={school.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                        <FaSchool className="text-purple-400" />
                        {school.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/60">
                        {school.address && (
                          <div className="flex items-center gap-2">
                            <FaMapMarkerAlt className="text-blue-400" />
                            <span>{school.address}, {school.city}, {school.state} {school.pincode}</span>
                          </div>
                        )}
                        {school.contactPhone && (
                          <div className="flex items-center gap-2">
                            <FaPhone className="text-green-400" />
                            <span>{school.contactPhone}</span>
                          </div>
                        )}
                        {school.website && (
                          <div className="flex items-center gap-2">
                            <FaGlobe className="text-cyan-400" />
                            <a href={school.website} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400">
                              {school.website}
                            </a>
                          </div>
                        )}
                        {school.boardAffiliation && (
                          <div className="flex items-center gap-2">
                            <FaGraduationCap className="text-yellow-400" />
                            <span>{school.boardAffiliation}</span>
                          </div>
                        )}
                        {school.establishedYear && (
                          <div className="flex items-center gap-2">
                            <FaCalendarAlt className="text-orange-400" />
                            <span>Est. {school.establishedYear}</span>
                          </div>
                        )}
                        {school.schoolType && (
                          <div className="flex items-center gap-2">
                            <FaBuilding className="text-pink-400" />
                            <span>{school.schoolType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openEditModal(school)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all text-sm flex items-center gap-2"
                    >
                      <FaEdit />
                      Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FaUsers className="text-purple-400" />
                        <span className="text-white/70 text-sm font-medium">Principal</span>
                      </div>
                      {schoolPrincipal ? (
                        <p className="text-white/50 text-sm">{schoolPrincipal.name || schoolPrincipal.displayName || schoolPrincipal.email}</p>
                      ) : (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignPrincipal(school.id, e.target.value);
                            }
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                          defaultValue=""
                        >
                          <option value="">Assign Principal</option>
                          {principals.map(p => (
                            <option key={p.uid} value={p.uid}>
                              {p.name || p.displayName || p.email}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FaUsers className="text-blue-400" />
                        <span className="text-white/70 text-sm font-medium">Teachers ({schoolTeachers.length})</span>
                      </div>
                      <p className="text-white/50 text-sm">{schoolTeachers.length} teachers</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FaUsers className="text-green-400" />
                        <span className="text-white/70 text-sm font-medium">Students ({schoolStudents.length})</span>
                      </div>
                      <p className="text-white/50 text-sm">{schoolStudents.length} students</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create School Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-white mb-4">Create New School</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-white/70 text-sm mb-1 block">School Name *</label>
                  <input
                    type="text"
                    value={newSchoolData.name}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })}
                    placeholder="Enter school name"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-white/70 text-sm mb-1 block">Address</label>
                  <input
                    type="text"
                    value={newSchoolData.address}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, address: e.target.value })}
                    placeholder="Street address"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">City</label>
                  <input
                    type="text"
                    value={newSchoolData.city}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, city: e.target.value })}
                    placeholder="City"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">State</label>
                  <input
                    type="text"
                    value={newSchoolData.state}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, state: e.target.value })}
                    placeholder="State"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Pincode</label>
                  <input
                    type="text"
                    value={newSchoolData.pincode}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, pincode: e.target.value })}
                    placeholder="Pincode"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Contact Person</label>
                  <input
                    type="text"
                    value={newSchoolData.contactPerson}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPerson: e.target.value })}
                    placeholder="Contact person name"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Contact Phone</label>
                  <input
                    type="text"
                    value={newSchoolData.contactPhone}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPhone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Website</label>
                  <input
                    type="url"
                    value={newSchoolData.website}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, website: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Board Affiliation</label>
                  <input
                    type="text"
                    value={newSchoolData.boardAffiliation}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, boardAffiliation: e.target.value })}
                    placeholder="e.g., CBSE, RBSE, ICSE"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Established Year</label>
                  <input
                    type="text"
                    value={newSchoolData.establishedYear}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, establishedYear: e.target.value })}
                    placeholder="Year"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">School Type</label>
                  <input
                    type="text"
                    value={newSchoolData.schoolType}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, schoolType: e.target.value })}
                    placeholder="e.g., Private, Public, International"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSchool}
                  className="flex-1 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all"
                >
                  Create School
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit School Modal */}
        {showEditModal && selectedSchool && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-white mb-4">Edit School: {selectedSchool.name}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Same form fields as create modal */}
                <div className="md:col-span-2">
                  <label className="text-white/70 text-sm mb-1 block">School Name *</label>
                  <input
                    type="text"
                    value={newSchoolData.name}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
                {/* Include all other fields similar to create modal */}
                <div className="md:col-span-2">
                  <label className="text-white/70 text-sm mb-1 block">Address</label>
                  <input
                    type="text"
                    value={newSchoolData.address}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, address: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
                {/* Add all other fields... */}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedSchool(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSchool}
                  className="flex-1 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all"
                >
                  Update School
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolManagement;
