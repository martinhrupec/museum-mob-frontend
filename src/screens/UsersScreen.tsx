import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  ScrollView,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { crossAlert } from '../utils/alert';
import { useAuthStore } from '../store/authStore';
import { 
  getUsers,
  getCurrentUser,
  createUser,
  updateUserProfile,
  updateUser,
  deleteUser,
  changePassword,
  setPassword,
} from '../api/endpoints';
import { User } from '../types';

type SortField = 'username' | 'last_name' | 'last_login' | 'last_mobile_login' | 'guard__priority_number' | 'date_joined';
type SortOrder = 'asc' | 'desc';

export default function UsersScreen() {
  const { user: currentUser, logout } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  
  // Filteri i sortiranje
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'guard'>('all');
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchText, setSearchText] = useState('');
  const [appliedSearchText, setAppliedSearchText] = useState('');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  
  // Temp state za filter modal (primjenjuje se tek na "Primijeni")
  const [tempRoleFilter, setTempRoleFilter] = useState<'all' | 'admin' | 'guard'>('all');
  const [tempIsActiveFilter, setTempIsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tempSortField, setTempSortField] = useState<SortField>('username');
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('asc');
  
  // Modali
  const [showActionModal, setShowActionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCurrentUserModal, setShowCurrentUserModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);

  // Form podaci
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'guard' as 'admin' | 'guard',
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });

  const [adminSetPasswordData, setAdminSetPasswordData] = useState({
    new_password: '',
    new_password_confirm: '',
  });

  // Funkcije za filter modal
  const openFiltersModal = () => {
    setTempRoleFilter(roleFilter);
    setTempIsActiveFilter(isActiveFilter);
    setTempSortField(sortField);
    setTempSortOrder(sortOrder);
    setShowFiltersModal(true);
  };

  const applyFilters = () => {
    setRoleFilter(tempRoleFilter);
    setIsActiveFilter(tempIsActiveFilter);
    setSortField(tempSortField);
    setSortOrder(tempSortOrder);
    setShowFiltersModal(false);
  };

  const cancelFilters = () => {
    setShowFiltersModal(false);
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, isActiveFilter, sortField, sortOrder, appliedSearchText]);

  const loadUsers = async (pageNum: number = page) => {
    try {
      setLoading(true);
      
      // Build filters object
      const filters: any = {};
      
      // Role filter
      if (roleFilter !== 'all') {
        filters.role = roleFilter;
      }
      
      // Active filter - show_inactive kontrolira da li prikazujemo neaktivne
      filters.show_inactive = isActiveFilter === 'inactive' || isActiveFilter === 'all';
      
      // Ordering - directly use sortField (no mapping needed)
      filters.ordering = sortOrder === 'asc' ? sortField : `-${sortField}`;
      
      const data = await getUsers(pageNum, filters);
      // Provjeravamo da li je paginirani response (Django REST Framework)
      let usersList = Array.isArray(data) ? data : (data.results || []);
      
      // Parsiraj priority_number iz string u number ako je string
      usersList = usersList.map((user: User) => {
        if (user.role === 'guard' && user.guard_profile && typeof user.guard_profile.priority_number === 'string') {
          return {
            ...user,
            guard_profile: {
              ...user.guard_profile,
              priority_number: parseFloat(user.guard_profile.priority_number)
            }
          };
        }
        return user;
      });
      
      // Frontend filtering za search text (backend ne podržava partial text search)
      if (appliedSearchText) {
        const searchLower = appliedSearchText.toLowerCase();
        usersList = usersList.filter((user: User) => {
          const matchesUsername = user.username.toLowerCase().includes(searchLower);
          const matchesFirstName = user.first_name?.toLowerCase().includes(searchLower);
          const matchesLastName = user.last_name?.toLowerCase().includes(searchLower);
          const matchesEmail = user.email?.toLowerCase().includes(searchLower);
          const matchesId = user.id.toString().includes(searchLower);
          return matchesUsername || matchesFirstName || matchesLastName || matchesEmail || matchesId;
        });
      }
      
      setUsers(usersList);
      
      // Postavlja pagination podatke
      if (!Array.isArray(data)) {
        setNext(data.next || null);
        setPrev(data.previous || null);
        setCount(data.count || 0);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      crossAlert('Greška', 'Nije moguće učitati korisnike');
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (user: User) => {
    if (!isAdmin) return; // Guard ne može kliknuti na druge
    setSelectedUser(user);
    setShowActionModal(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    crossAlert(
      'Brisanje korisnika',
      `Jeste li sigurni da želite obrisati korisnika ${selectedUser.username}?`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Obriši',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(selectedUser.id);
              crossAlert('Uspjeh', 'Korisnik je obrisan');
              setShowActionModal(false);
              loadUsers();
            } catch (error: any) {
              crossAlert('Greška', error.response?.data?.detail || 'Nije moguće obrisati korisnika');
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = async (userId?: number) => {
    try {
      // Ako je admin i klikne na nekog korisnika, može mijenjati sve
      // Ako je guard ili klikne na "Promijeni svoj profil", samo svoj profil
      const userData = userId 
        ? users.find(u => u.id === userId) 
        : await getCurrentUser();
      
      if (userData) {
        setFormData({
          username: userData.username,
          password: '',
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          role: userData.role,
        });
        setSelectedUser(userData);
        setShowActionModal(false);
        setShowEditModal(true);
      }
    } catch (error) {
      crossAlert('Greška', 'Nije moguće učitati podatke korisnika');
    }
  };

  const handleCreateUser = async () => {
    if (!formData.username || !formData.password) {
      crossAlert('Greška', 'Korisničko ime i lozinka su obavezni');
      return;
    }

    // Frontend validacija emaila
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        crossAlert('Greška', 'Unesite ispravan email format (npr. ime@domena.com)');
        return;
      }
    }

    if (creatingUser) return; // Spriječi duplo klikanje

    try {
      setCreatingUser(true);
      await createUser(formData);
      crossAlert('Uspjeh', 'Korisnik je kreiran');
      setShowCreateModal(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('Create user error:', error);
      
      // Bolje error poruke
      let errorMessage = 'Nije moguće kreirati korisnika';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Provjeri različite error formate
        if (data.username) {
          errorMessage = `Username: ${Array.isArray(data.username) ? data.username[0] : data.username}`;
        } else if (data.email) {
          errorMessage = `Email: ${Array.isArray(data.email) ? data.email[0] : data.email}`;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      
      crossAlert('Greška', errorMessage);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (updatingProfile) return;

    // Frontend validacija emaila
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        crossAlert('Greška', 'Unesite ispravan email format (npr. ime@domena.com)');
        return;
      }
    }

    try {
      setUpdatingProfile(true);
      
      // Ako admin edituje drugog korisnika, koristi updateUser endpoint
      if (isAdmin && selectedUser && selectedUser.id !== currentUser?.id) {
        await updateUser(selectedUser.id, {
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          role: formData.role,
        });
      } else {
        // Inače koristi updateUserProfile za svoj profil
        await updateUserProfile({
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
        });
      }
      
      crossAlert('Uspjeh', 'Profil je ažuriran');
      setShowEditModal(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('Update profile error:', error);
      
      // Bolje error poruke
      let errorMessage = 'Nije moguće ažurirati profil';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Provjeri različite error formate
        if (data.email) {
          errorMessage = `Email: ${Array.isArray(data.email) ? data.email[0] : data.email}`;
        } else if (data.username) {
          errorMessage = `Username: ${Array.isArray(data.username) ? data.username[0] : data.username}`;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      
      crossAlert('Greška', errorMessage);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.old_password || !passwordData.new_password || !passwordData.new_password_confirm) {
      crossAlert('Greška', 'Sva polja su obavezna');
      return;
    }

    if (passwordData.new_password.length < 8) {
      crossAlert('Greška', 'Lozinka mora imati 8 znakova');
      return;
    }

    if (passwordData.new_password !== passwordData.new_password_confirm) {
      crossAlert('Greška', 'Nove lozinke se ne podudaraju');
      return;
    }

    if (changingPassword) return;

    try {
      setChangingPassword(true);
      await changePassword(currentUser!.id, passwordData);
      setShowPasswordModal(false);
      setPasswordData({ old_password: '', new_password: '', new_password_confirm: '' });
      crossAlert('Uspjeh', 'Lozinka je promijenjena. Molimo prijavite se ponovo.', [
        { text: 'OK', onPress: () => logout() },
      ]);
    } catch (error: any) {
      crossAlert('Greška', error.response?.data?.detail || 'Nije moguće promijeniti lozinku');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetPassword = async () => {
    if (!adminSetPasswordData.new_password || !adminSetPasswordData.new_password_confirm) {
      crossAlert('Greška', 'Sva polja su obavezna');
      return;
    }

    if (adminSetPasswordData.new_password.length < 8) {
      crossAlert('Greška', 'Lozinka mora imati 8 znakova');
      return;
    }

    if (adminSetPasswordData.new_password !== adminSetPasswordData.new_password_confirm) {
      crossAlert('Greška', 'Lozinke se ne podudaraju');
      return;
    }

    if (settingPassword || !selectedUser) return;

    try {
      setSettingPassword(true);
      await setPassword(selectedUser.id, adminSetPasswordData);
      crossAlert('Uspjeh', `Lozinka za ${selectedUser.username} je postavljena`);
      setShowSetPasswordModal(false);
      setAdminSetPasswordData({ new_password: '', new_password_confirm: '' });
    } catch (error: any) {
      crossAlert('Greška', error.response?.data?.detail || 'Nije moguće postaviti lozinku');
    } finally {
      setSettingPassword(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      role: 'guard',
    });
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isCurrentUser = item.id === currentUser?.id;
    
    return (
    <TouchableOpacity
      style={[styles.userCard, isCurrentUser && styles.currentUserCard]}
      onPress={() => handleUserPress(item)}
      disabled={!isAdmin || isCurrentUser}
    >
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>
            {item.role === 'admin' ? '⚖️' : '🛡️'} 
             {item.first_name && item.last_name 
              ? `${item.first_name} ${item.last_name}` 
              : item.username}
          </Text>
          {!item.is_active && <Text style={styles.inactiveBadge}>Neaktivan</Text>}
        </View>
        
        <Text style={styles.userUsername}>
          @{item.username}
        </Text>
        
        {item.email && <Text style={styles.userDetail}>{item.email}</Text>}
        
        {item.role === 'guard' && item.guard_profile && isAdmin && (
          <Text style={styles.userDetail}>Prioritet: {item.guard_profile.priority_number}</Text>
        )}
        
        {item.role === 'guard' && item.guard_profile && isAdmin && (
          <View>
            <Text style={styles.userDetail}>
              Dostupnost: {item.guard_profile.availability != null ? `${item.guard_profile.availability} smjena` : 'Nije postavljeno'}
            </Text>
            {item.guard_profile.availability_updated_at && (
              <Text style={styles.userTimestamp}>
                Dostupnost ažurirana: {new Date(item.guard_profile.availability_updated_at).toLocaleDateString('hr-HR')}
              </Text>
            )}
          </View>
        )}
        
        <Text style={styles.userTimestamp}>
          Pridružen/a: {new Date(item.date_joined).toLocaleDateString('hr-HR')}
        </Text>
        
        {isAdmin && (
          <Text style={styles.userTimestamp}>
            Zadnja web prijava: {item.last_login ? new Date(item.last_login).toLocaleDateString('hr-HR') : 'Nikad'}
          </Text>
        )}
        {isAdmin && (
          <Text style={styles.userTimestamp}>
            Zadnja prijava s mobilne aplikacije: {item.last_mobile_login ? new Date(item.last_mobile_login).toLocaleDateString('hr-HR') : 'Nikad'}
          </Text>
        )}
        {isAdmin && item.updated_at && (
          <Text style={styles.userTimestamp}>
            Profil ažuriran: {new Date(item.updated_at).toLocaleDateString('hr-HR')}
          </Text>
        )}
      </View>
      {isAdmin && !isCurrentUser && <Text style={styles.arrow}>›</Text>}
      {isCurrentUser && (
        <TouchableOpacity
          style={styles.currentUserButton}
          onPress={() => setShowCurrentUserModal(true)}
        >
          <Text style={styles.currentUserButtonIcon}>⚙️</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0A3323" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header sa filterima */}
      <View style={styles.header}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Pretraži korisnike..."
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            returnKeyType="search"
            blurOnSubmit={true}
            onSubmitEditing={() => {
              setAppliedSearchText(searchText);
              Keyboard.dismiss();
            }}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setAppliedSearchText(''); }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => {
              setAppliedSearchText(searchText);
              Keyboard.dismiss();
            }}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={openFiltersModal}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Active filters display */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFilters}>
          {roleFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Uloga: {roleFilter === 'admin' ? 'Administrator' : 'Čuvar'}
              </Text>
              <TouchableOpacity onPress={() => setRoleFilter('all')}>
                <Text style={styles.filterChipClose}> ✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {isActiveFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Status: {isActiveFilter === 'active' ? 'Aktivan' : 'Neaktivan'}
              </Text>
              <TouchableOpacity onPress={() => setIsActiveFilter('all')}>
                <Text style={styles.filterChipClose}> ✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>
              Sort: {sortField} {sortOrder === 'asc' ? '↑' : '↓'}
            </Text>
          </View>
        </ScrollView>

        {/* Button za kreiranje korisnika */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            <Text style={styles.createButtonText}>+ Kreiraj novog korisnika</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista korisnika */}
      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
      />

      {/* Pagination Controls */}
      {!loading && (prev || next) && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity 
            style={[styles.paginationButton, !prev && styles.paginationButtonDisabled]}
            onPress={() => {
              if (prev) {
                const newPage = Math.max(1, page - 1);
                setPage(newPage);
                loadUsers(newPage);
              }
            }}
            disabled={!prev}
          >
            <Text style={[styles.paginationButtonText, !prev && styles.paginationButtonTextDisabled]}>
              Prethodna
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.paginationText}>Stranica {page}</Text>
          
          <TouchableOpacity 
            style={[styles.paginationButton, !next && styles.paginationButtonDisabled]}
            onPress={() => {
              if (next) {
                const newPage = page + 1;
                setPage(newPage);
                loadUsers(newPage);
              }
            }}
            disabled={!next}
          >
            <Text style={[styles.paginationButtonText, !next && styles.paginationButtonTextDisabled]}>
              Sljedeća
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal za admin akcije (Obriši / Uredi profil) */}
      <Modal visible={showActionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <Text style={styles.modalTitle}>Odaberi akciju</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditProfile(selectedUser?.id)}
            >
              <Text style={styles.actionButtonText}>Uredi profil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActionModal(false);
                setShowSetPasswordModal(true);
              }}
            >
              <Text style={styles.actionButtonText}>Promijeni lozinku</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDeleteUser}
            >
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Obriši</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal za kreiranje novog korisnika */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps='handled'>
              <Text style={styles.modalTitle}>Kreiraj novog korisnika</Text>
              
              <Text style={styles.label}>Korisničko ime *</Text>
              <TextInput
                style={styles.input}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={styles.label}>Lozinka *</Text>
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
              />

              <Text style={styles.label}>Ime</Text>
              <TextInput
                style={styles.input}
                value={formData.first_name}
                onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={styles.label}>Prezime</Text>
              <TextInput
                style={styles.input}
                value={formData.last_name}
                onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleCreateUser}
              />

              <Text style={styles.label}>Uloga *</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[styles.roleButton, formData.role === 'guard' && styles.roleButtonActive]}
                  onPress={() => setFormData({ ...formData, role: 'guard' })}
                >
                  <Text style={[styles.roleButtonText, formData.role === 'guard' && styles.roleButtonTextActive]}>
                    Čuvar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleButton, formData.role === 'admin' && styles.roleButtonActive]}
                  onPress={() => setFormData({ ...formData, role: 'admin' })}
                >
                  <Text style={[styles.roleButtonText, formData.role === 'admin' && styles.roleButtonTextActive]}>
                    Administrator
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Odustani</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, creatingUser && styles.modalButtonDisabled]}
                  onPress={handleCreateUser}
                  disabled={creatingUser}
                >
                  <Text style={styles.modalButtonText}>{creatingUser ? 'Kreiranje...' : 'Kreiraj'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal za ažuriranje profila */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps='handled'>
              <Text style={styles.modalTitle}>
                {isAdmin && selectedUser && selectedUser.id !== currentUser?.id 
                  ? `Uredi korisnika: ${selectedUser.username}` 
                  : 'Promijeni svoj profil'}
              </Text>
              
              <Text style={styles.label}>Korisničko ime</Text>
              <TextInput
                style={styles.input}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={styles.label}>Ime</Text>
              <TextInput
                style={styles.input}
                value={formData.first_name}
                onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={styles.label}>Prezime</Text>
              <TextInput
                style={styles.input}
                value={formData.last_name}
                onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleUpdateProfile}
              />

              {isAdmin && selectedUser && selectedUser.id !== currentUser?.id && (
                <>
                  <Text style={styles.label}>Uloga</Text>
                  <View style={styles.roleButtons}>
                    <TouchableOpacity
                      style={[styles.roleButton, formData.role === 'guard' && styles.roleButtonActive]}
                      onPress={() => setFormData({ ...formData, role: 'guard' })}
                    >
                      <Text style={[styles.roleButtonText, formData.role === 'guard' && styles.roleButtonTextActive]}>
                        Čuvar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleButton, formData.role === 'admin' && styles.roleButtonActive]}
                      onPress={() => setFormData({ ...formData, role: 'admin' })}
                    >
                      <Text style={[styles.roleButtonText, formData.role === 'admin' && styles.roleButtonTextActive]}>
                        Administrator
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, updatingProfile && styles.modalButtonDisabled]}
                  onPress={handleUpdateProfile}
                  disabled={updatingProfile}
                >
                  <Text style={styles.modalButtonText}>{updatingProfile ? 'Spremanje...' : 'Spremi'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Odustani</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal za promjenu lozinke */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModalContent}>
            <Text style={styles.modalTitle}>Promijeni lozinku</Text>
            
            <Text style={styles.label}>Stara lozinka</Text>
            <TextInput
              style={styles.input}
              value={passwordData.old_password}
              onChangeText={(text) => setPasswordData({ ...passwordData, old_password: text })}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
            />

            <Text style={styles.label}>Nova lozinka</Text>
            <TextInput
              style={styles.input}
              value={passwordData.new_password}
              onChangeText={(text) => setPasswordData({ ...passwordData, new_password: text })}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
            />

            <Text style={styles.label}>Potvrdi novu lozinku</Text>
            <TextInput
              style={styles.input}
              value={passwordData.new_password_confirm}
              onChangeText={(text) => setPasswordData({ ...passwordData, new_password_confirm: text })}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleChangePassword}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, changingPassword && styles.modalButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                <Text style={styles.modalButtonText}>{changingPassword ? 'Mijenjanje...' : 'Promijeni'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ old_password: '', new_password: '', new_password_confirm: '' });
                }}
              >
                <Text style={styles.modalCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal za admin postavljanje lozinke drugog korisnika */}
      <Modal visible={showSetPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModalContent}>
            <Text style={styles.modalTitle}>Postavi lozinku</Text>
            {selectedUser && (
              <Text style={styles.label}>Korisnik: {selectedUser.username}</Text>
            )}

            <Text style={styles.label}>Nova lozinka</Text>
            <TextInput
              style={styles.input}
              value={adminSetPasswordData.new_password}
              onChangeText={(text) => setAdminSetPasswordData({ ...adminSetPasswordData, new_password: text })}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
            />

            <Text style={styles.label}>Potvrdi novu lozinku</Text>
            <TextInput
              style={styles.input}
              value={adminSetPasswordData.new_password_confirm}
              onChangeText={(text) => setAdminSetPasswordData({ ...adminSetPasswordData, new_password_confirm: text })}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSetPassword}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, settingPassword && styles.modalButtonDisabled]}
                onPress={handleSetPassword}
                disabled={settingPassword}
              >
                <Text style={styles.modalButtonText}>{settingPassword ? 'Postavljanje...' : 'Postavi'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowSetPasswordModal(false);
                  setAdminSetPasswordData({ new_password: '', new_password_confirm: '' });
                }}
              >
                <Text style={styles.modalCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal za trenutnog korisnika (svoj profil/lozinka) */}
      <Modal visible={showCurrentUserModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <Text style={styles.modalTitle}>Moj profil</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowCurrentUserModal(false);
                handleEditProfile();
              }}
            >
              <Text style={styles.actionButtonText}>✏️ Promijeni profil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowCurrentUserModal(false);
                setShowPasswordModal(true);
              }}
            >
              <Text style={styles.actionButtonText}>🔒 Promijeni lozinku</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCurrentUserModal(false)}
            >
              <Text style={styles.cancelButtonText}>Zatvori</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal za filtere i sortiranje */}
      <Modal visible={showFiltersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filtersModalContent}>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* FILTERI */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>FILTERI</Text>

                <Text style={styles.label}>Uloga</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowRoleDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempRoleFilter === 'all' ? 'Svi korisnici' : tempRoleFilter === 'admin' ? 'Administratori' : 'Čuvari'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowStatusDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempIsActiveFilter === 'all' ? 'Svi' : tempIsActiveFilter === 'active' ? 'Aktivni' : 'Neaktivni'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SORTIRANJE */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>SORTIRANJE</Text>

                <Text style={styles.label}>Sortiraj po</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowSortDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortField === 'username' ? 'Korisničko ime' :
                       tempSortField === 'last_name' ? 'Prezime' :
                       tempSortField === 'last_login' ? 'Zadnja web prijava' :
                       tempSortField === 'last_mobile_login' ? 'Zadnja mobilna prijava' :
                       tempSortField === 'date_joined' ? 'Datum registracije' :
                       tempSortField === 'guard__priority_number' ? 'Prioritet' : tempSortField}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Redoslijed</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowOrderDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortOrder === 'asc' ? '↑ Uzlazno (A-Z, 1-9)' : '↓ Silazno (Z-A, 9-1)'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* BUTTONS - FIKSIRAN NA DNU */}
            <View style={styles.filtersModalFooter}>
              <TouchableOpacity
                style={styles.filterCancelButton}
                onPress={cancelFilters}
              >
                <Text style={styles.filterCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={applyFilters}
              >
                <Text style={styles.filterApplyButtonText}>Primijeni</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dropdown modali za filtere - renderovani NAKON filter modala da budu iznad na webu */}
      <Modal visible={showRoleDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowRoleDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Odaberi rolu</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempRoleFilter === 'all' && styles.dropdownItemActive]}
              onPress={() => {
                setTempRoleFilter('all');
                setShowRoleDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempRoleFilter === 'all' && styles.dropdownItemTextActive]}>
                Svi korisnici
              </Text>
              {tempRoleFilter === 'all' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempRoleFilter === 'admin' && styles.dropdownItemActive]}
              onPress={() => {
                setTempRoleFilter('admin');
                setShowRoleDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempRoleFilter === 'admin' && styles.dropdownItemTextActive]}>
                Administratori
              </Text>
              {tempRoleFilter === 'admin' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempRoleFilter === 'guard' && styles.dropdownItemActive]}
              onPress={() => {
                setTempRoleFilter('guard');
                setShowRoleDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempRoleFilter === 'guard' && styles.dropdownItemTextActive]}>
                Čuvari
              </Text>
              {tempRoleFilter === 'guard' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showStatusDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Odaberi status</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempIsActiveFilter === 'all' && styles.dropdownItemActive]}
              onPress={() => {
                setTempIsActiveFilter('all');
                setShowStatusDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempIsActiveFilter === 'all' && styles.dropdownItemTextActive]}>
                Svi
              </Text>
              {tempIsActiveFilter === 'all' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempIsActiveFilter === 'active' && styles.dropdownItemActive]}
              onPress={() => {
                setTempIsActiveFilter('active');
                setShowStatusDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempIsActiveFilter === 'active' && styles.dropdownItemTextActive]}>
                Aktivni
              </Text>
              {tempIsActiveFilter === 'active' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempIsActiveFilter === 'inactive' && styles.dropdownItemActive]}
              onPress={() => {
                setTempIsActiveFilter('inactive');
                setShowStatusDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempIsActiveFilter === 'inactive' && styles.dropdownItemTextActive]}>
                Neaktivni
              </Text>
              {tempIsActiveFilter === 'inactive' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showSortDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Sortiraj po</Text>
            <ScrollView style={styles.dropdownScroll}>
              {(['username', 'last_name', 'last_login', 'last_mobile_login', 'date_joined'] as SortField[]).map(field => (
                <TouchableOpacity
                  key={field}
                  style={[styles.dropdownItem, tempSortField === field && styles.dropdownItemActive]}
                  onPress={() => {
                    setTempSortField(field);
                    setShowSortDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, tempSortField === field && styles.dropdownItemTextActive]}>
                    {field === 'username' ? 'Korisničko ime' :
                     field === 'last_name' ? 'Prezime' :
                     field === 'last_login' ? 'Zadnja prijava' :
                     field === 'last_mobile_login' ? 'Zadnja mobilna prijava' :
                     field === 'date_joined' ? 'Datum registracije' : field}
                  </Text>
                  {tempSortField === field && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.dropdownItem, tempSortField === 'guard__priority_number' && styles.dropdownItemActive]}
                  onPress={() => {
                    setTempSortField('guard__priority_number');
                    setShowSortDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, tempSortField === 'guard__priority_number' && styles.dropdownItemTextActive]}>
                    Prioritet
                  </Text>
                  {tempSortField === 'guard__priority_number' && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showOrderDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowOrderDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Redoslijed</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'asc' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortOrder('asc');
                setShowOrderDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'asc' && styles.dropdownItemTextActive]}>
                ↑ Uzlazno (A-Z, 1-9)
              </Text>
              {tempSortOrder === 'asc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'desc' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortOrder('desc');
                setShowOrderDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'desc' && styles.dropdownItemTextActive]}>
                ↓ Silazno (Z-A, 9-1)
              </Text>
              {tempSortOrder === 'desc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#D3968C',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#0A3323',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 10,
    paddingRight: 35,
    fontSize: 15,
    backgroundColor: '#F7F4D5',
    color: '#0A3323',
  },
  searchButton: {
    backgroundColor: '#0A3323',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
  },
  clearIcon: {
    fontSize: 18,
    color: '#D3968C',
    position: 'absolute',
    right: 90,
    padding: 4,
  },
  filterIconButton: {
    backgroundColor: '#0A3323',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: 45,
  },
  filterIcon: {
    fontSize: 20,
    color: '#A6C27A',
  },
  activeFilters: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  filterChip: {
    flexDirection: 'row',
    backgroundColor: '#105666',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  filterChipText: {
    color: '#A6C27A',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipClose: {
    color: '#A6C27A',
    fontSize: 14,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#0A3323',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 15,
  },
  list: {
    padding: 15,
  },
  userCard: {
    backgroundColor: '#A6C27A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentUserCard: {
    backgroundColor: '#A6C27A',
    borderWidth: 2,
    borderColor: '#105666',
  },
  currentUserButton: {
    backgroundColor: '#105666',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  currentUserButtonIcon: {
    fontSize: 18,
    color: '#A6C27A',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#0A3323',
  },
  inactiveBadge: {
    fontSize: 11,
    color: '#0A3323',
    backgroundColor: '#D3968C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '600',
    marginLeft: 10,
  },
  userUsername: {
    fontSize: 13,
    color: '#0A3323',
    fontWeight: '500',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  userRole: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 4,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 12,
    color: '#0A3323',
    marginBottom: 2,
  },
  userDetail: {
    fontSize: 13,
    marginBottom: 3,
    marginTop: 3,
    color: '#0A3323',
    fontWeight: '500',
  },
  userMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  userTimestamp: {
    fontSize: 13,
    color: '#0A3323',
    marginTop: 3,
    marginBottom: 3,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 24,
    color: '#0A3323',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  modalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  filtersModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  filterSection: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 15,
  },
  pickerContainer: {
    marginBottom: 15,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 14,
  },
  pickerText: {
    fontSize: 15,
    color: '#0A3323',
    fontWeight: '500',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#D3968C',
  },
  filtersModalFooter: {
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#105666',
    gap: 10,
  },
  filterCancelButton: {
    flex: 1,
    backgroundColor: '#D3968C',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterCancelButtonText: {
    color: '#0A3323',
    fontWeight: '700',
    fontSize: 17,
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    color: '#A6C27A',
    fontWeight: '700',
    fontSize: 17,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 15,
    width: '80%',
    maxWidth: 350,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 15,
    textAlign: 'center',
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F4D5',
  },
  dropdownItemActive: {
    backgroundColor: '#A6C27A',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#0A3323',
  },
  dropdownItemTextActive: {
    color: '#0A3323',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#105666',
    fontWeight: 'bold',
  },
  modalButtonDisabled: {
    backgroundColor: '#D3968C',
    opacity: 0.6,
  },
  filtersScrollView: {
    maxHeight: '100%',
  },
  filtersModalButtons: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#A6C27A',
  },
  passwordModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#0A3323',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F7F4D5',
    color: '#0A3323',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
    marginBottom: 15,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6C27A',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#0A3323',
    borderColor: '#0A3323',
  },
  roleButtonText: {
    color: '#0A3323',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#A6C27A',
  },
  actionButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#0A3323',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#D3968C',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#A6C27A',
  },
  deleteButtonText: {
    color: '#0A3323',
  },
  cancelButton: {
    padding: 15,
    marginTop: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#D3968C',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 16,
  },
  modalCancelButton: {
    backgroundColor: '#D3968C',
  },
  modalCancelButtonText: {
    color: '#0A3323',
    fontWeight: '600',
    fontSize: 16,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F7F4D5',
    borderTopWidth: 1,
    borderTopColor: '#A6C27A',
  },
  paginationButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  paginationButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationButtonTextDisabled: {
    color: '#0A3323',
  },
  paginationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A3323',
  },
});
