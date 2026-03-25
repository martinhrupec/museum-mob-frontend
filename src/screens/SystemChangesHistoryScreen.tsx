import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { getAuditLogs, getUsers } from '../api/endpoints';
import { AuditLog, AuditLogListResponse, AuditLogAction, AuditLogFilters, User } from '../types';

type SortOrder = 'asc' | 'desc';

// Prijevodi za tipove akcija na hrvatski
const ACTION_LABELS: Record<AuditLogAction, string> = {
  'CREATE': 'Kreiranje',
  'UPDATE': 'Ažuriranje',
  'DELETE': 'Brisanje',
  'BULK_UPDATE': 'Višestruko ažuriranje',
  'BULK_DELETE': 'Višestruko brisanje',
};

// Prijevodi za modele na hrvatski - u genitivu
const MODEL_LABELS: Record<string, string> = {
  'Exhibition': 'izložbe',
  'User': 'korisnika',
  'Position': 'pozicije',
  'AdminNotification': 'obavijesti',
  'Point': 'boda',
  'PositionHistory': 'akcije na poziciju',
  'Report': 'prijave recepciji',
  'NonWorkingDay': 'neradnog dana',
  'SystemSettings': 'postavki sustava',
  'Guard': 'čuvara',
  'GuardWorkPeriod': 'dostupnih radnih perioda',
  'GuardExhibitionPreference': 'preferencije čuvara za izložbe',
  'GuardDayPreference': 'preferencije čuvara za dane',
};

// Stilovi za badge-ove različitih akcija
const ACTION_STYLES: Record<AuditLogAction, { bg: string; text: string }> = {
  'CREATE': { bg: '#A6C27A', text: '#F7F4D5' },
  'UPDATE': { bg: '#105666', text: '#F7F4D5' },
  'DELETE': { bg: '#D3968C', text: '#0A3323' },
  'BULK_UPDATE': { bg: '#105666', text: '#F7F4D5' },
  'BULK_DELETE': { bg: '#D3968C', text: '#0A3323' },
};

// Generiraj godine za filter (trenutna +/- 2)
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years: { value: number | null; label: string }[] = [{ value: null, label: 'Sve godine' }];
  for (let y = currentYear + 1; y >= currentYear - 3; y--) {
    years.push({ value: y, label: y.toString() });
  }
  return years;
};

const YEARS = generateYears();

// Mjeseci
const MONTHS: { value: number | null; label: string }[] = [
  { value: null, label: 'Svi mjeseci' },
  { value: 1, label: 'Siječanj' },
  { value: 2, label: 'Veljača' },
  { value: 3, label: 'Ožujak' },
  { value: 4, label: 'Travanj' },
  { value: 5, label: 'Svibanj' },
  { value: 6, label: 'Lipanj' },
  { value: 7, label: 'Srpanj' },
  { value: 8, label: 'Kolovoz' },
  { value: 9, label: 'Rujan' },
  { value: 10, label: 'Listopad' },
  { value: 11, label: 'Studeni' },
  { value: 12, label: 'Prosinac' },
];

// Dani (1-31)
const generateDays = () => {
  const days: { value: number | null; label: string }[] = [{ value: null, label: 'Svi dani' }];
  for (let d = 1; d <= 31; d++) {
    days.push({ value: d, label: d.toString() });
  }
  return days;
};

const DAYS = generateDays();

// Akcije za filter
const ACTIONS: { value: AuditLogAction | null; label: string }[] = [
  { value: null, label: 'Sve akcije' },
  { value: 'CREATE', label: 'Kreiranje' },
  { value: 'UPDATE', label: 'Ažuriranje' },
  { value: 'DELETE', label: 'Brisanje' },
  { value: 'BULK_UPDATE', label: 'Višestruko ažuriranje' },
  { value: 'BULK_DELETE', label: 'Višestruko brisanje' },
];

export default function SystemChangesHistoryScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Data state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  // Filter & Sort state
  const [actionFilter, setActionFilter] = useState<AuditLogAction | null>(null);
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Modal state
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showDayDropdown, setShowDayDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Temp state za filter modal (primjenjuje se tek na "Primijeni")
  const [tempActionFilter, setTempActionFilter] = useState<AuditLogAction | null>(null);
  const [tempUserFilter, setTempUserFilter] = useState<number | null>(null);
  const [tempYearFilter, setTempYearFilter] = useState<number | null>(null);
  const [tempMonthFilter, setTempMonthFilter] = useState<number | null>(null);
  const [tempDayFilter, setTempDayFilter] = useState<number | null>(null);
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('desc');

  // Ref to track initial load
  const initialLoadDone = useRef(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) {
      // Reset to page 1 when filters change
      if (page !== 1) {
        setPage(1);
      } else {
        fetchAuditLogs(1);
      }
    }
  }, [actionFilter, userFilter, yearFilter, monthFilter, dayFilter, sortOrder]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Dohvati korisnike za filter dropdown (samo admin ima pristup)
      if (isAdmin) {
        try {
          const usersResponse = await getUsers(1, { show_inactive: true });
          // Handle paginated response - get all users from first page
          const usersList = Array.isArray(usersResponse) ? usersResponse : (usersResponse.results || []);
          setUsers(usersList);
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      }

      // Load initial audit logs
      await fetchAuditLogs(1);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async (pageNum: number = page) => {
    try {
      if (!initialLoadDone.current) {
        setLoading(true);
      }

      // Build filters for backend
      const filters: AuditLogFilters = {};

      if (actionFilter) {
        filters.action = actionFilter;
      }

      if (userFilter !== null) {
        filters.user_id = userFilter;
      }

      if (yearFilter !== null) {
        filters.year = yearFilter;
      }

      if (monthFilter !== null) {
        filters.month = monthFilter;
      }

      if (dayFilter !== null) {
        filters.day = dayFilter;
      }

      filters.ordering = sortOrder === 'desc' ? '-timestamp' : 'timestamp';

      const response: AuditLogListResponse = await getAuditLogs(pageNum, filters);

      setAuditLogs(response.results);
      setNext(response.next || null);
      setPrev(response.previous || null);
      setCount(response.count || 0);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAuditLogs(1);
  }, [actionFilter, userFilter, yearFilter, monthFilter, dayFilter, sortOrder]);

  // Funkcije za filter modal
  const openFiltersModal = () => {
    setTempActionFilter(actionFilter);
    setTempUserFilter(userFilter);
    setTempYearFilter(yearFilter);
    setTempMonthFilter(monthFilter);
    setTempDayFilter(dayFilter);
    setTempSortOrder(sortOrder);
    setShowFiltersModal(true);
  };

  const applyFilters = () => {
    setActionFilter(tempActionFilter);
    setUserFilter(tempUserFilter);
    setYearFilter(tempYearFilter);
    setMonthFilter(tempMonthFilter);
    setDayFilter(tempDayFilter);
    setSortOrder(tempSortOrder);
    setShowFiltersModal(false);
  };

  const cancelFilters = () => {
    setShowFiltersModal(false);
  };

  const resetFilters = () => {
    setTempActionFilter(null);
    setTempUserFilter(null);
    setTempYearFilter(null);
    setTempMonthFilter(null);
    setTempDayFilter(null);
    setTempSortOrder('desc');
  };

  const getUserDisplayName = (userId: number | null): string => {
    if (userId === null) return 'Svi korisnici';
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.full_name || foundUser?.username || 'Nepoznato';
  };

  const getActionDisplayName = (action: AuditLogAction | null): string => {
    if (action === null) return 'Sve akcije';
    return ACTION_LABELS[action] || action;
  };

  const getYearDisplayName = (year: number | null): string => {
    if (year === null) return 'Sve godine';
    return year.toString();
  };

  const getMonthDisplayName = (month: number | null): string => {
    if (month === null) return 'Svi mjeseci';
    const found = MONTHS.find(m => m.value === month);
    return found?.label || month.toString();
  };

  const getDayDisplayName = (day: number | null): string => {
    if (day === null) return 'Svi dani';
    return day.toString();
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatChanges = (changes: Record<string, any>): string => {
    if (!changes || Object.keys(changes).length === 0) {
      return '';
    }
    try {
      return JSON.stringify(changes, null, 2);
    } catch {
      return '';
    }
  };

  const hasActiveFilters = (): boolean => {
    return actionFilter !== null || userFilter !== null || yearFilter !== null || monthFilter !== null || dayFilter !== null;
  };

  // Kombinira akciju i model u hrvatski genitivni oblik (npr. "Brisanje korisnika")
  const getCombinedActionLabel = (action: AuditLogAction, modelName: string): string => {
    const actionLabel = ACTION_LABELS[action] || action;
    const modelLabel = MODEL_LABELS[modelName] || modelName.toLowerCase();
    return `${actionLabel} ${modelLabel}`;
  };

  const renderAuditLogItem = ({ item }: { item: AuditLog }) => {
    const actionStyle = ACTION_STYLES[item.action] || { bg: '#e2e3e5', text: '#383d41' };
    const changesStr = formatChanges(item.changes);

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={[styles.actionBadge, { backgroundColor: actionStyle.bg }]}>
            <Text style={[styles.actionBadgeText, { color: actionStyle.text }]}>
              {getCombinedActionLabel(item.action, item.model_name)}
            </Text>
          </View>
        </View>

        <View style={styles.logContent}>
          <Text style={styles.objectRepr}>{item.object_repr}</Text>
          
          {changesStr ? (
            <View style={styles.changesContainer}>
              <Text style={styles.changesLabel}>Promjene:</Text>
              <Text style={styles.changesText}>{changesStr}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.logFooter}>
          <Text style={styles.userInfo}>
            👤 {item.user_full_name || item.user_name || 'Nepoznato'}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Povijest promjena sustava</Text>
        <TouchableOpacity
          style={[styles.filterButton, hasActiveFilters() && styles.filterButtonActive]}
          onPress={openFiltersModal}
        >
          <Text style={styles.filterButtonText}>⚙️ Filteri</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.countText}>
        Ukupno zapisa: {count}
      </Text>
    </View>
  );

  // Ako nije admin, prikaži poruku
  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Nemate pristup ovoj stranici.</Text>
      </View>
    );
  }

  if (loading && auditLogs.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0A3323" />
        <Text style={styles.loadingText}>Učitavanje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={auditLogs}
        renderItem={renderAuditLogItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nema zapisa za prikaz.</Text>
          </View>
        }
        ListFooterComponent={
          (next || prev) ? (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, !prev && styles.paginationButtonDisabled]}
                onPress={() => prev && fetchAuditLogs(page - 1)}
                disabled={!prev}
              >
                <Text style={[styles.paginationButtonText, !prev && styles.paginationButtonTextDisabled]}>
                  Prethodna
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.pageInfo}>Stranica {page}</Text>
              
              <TouchableOpacity
                style={[styles.paginationButton, !next && styles.paginationButtonDisabled]}
                onPress={() => next && fetchAuditLogs(page + 1)}
                disabled={!next}
              >
                <Text style={[styles.paginationButtonText, !next && styles.paginationButtonTextDisabled]}>
                  Sljedeća
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Filter/Sort Modal */}
      <Modal visible={showFiltersModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.filtersModalContent}>            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.filtersScroll}>
              {/* FILTERI */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>FILTERI</Text>
                
                {/* Korisnik */}
                <Text style={styles.label}>Korisnik</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowUserDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {getUserDisplayName(tempUserFilter)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Akcija */}
                <Text style={styles.label}>Tip akcije</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowActionDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {getActionDisplayName(tempActionFilter)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Godina */}
                <Text style={styles.label}>Godina</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowYearDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {getYearDisplayName(tempYearFilter)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Mjesec */}
                <Text style={styles.label}>Mjesec</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowMonthDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {getMonthDisplayName(tempMonthFilter)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Dan */}
                <Text style={styles.label}>Dan</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowDayDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {getDayDisplayName(tempDayFilter)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SORTIRANJE */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>SORTIRANJE</Text>
                
                <Text style={styles.label}>Redoslijed po vremenu</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowSortDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortOrder === 'asc' ? '↑ Uzlazno (najstarije prvo)' : '↓ Silazno (najnovije prvo)'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            {/* BUTTONS */}
            <View style={styles.filtersModalFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetButtonText}>Resetiraj</Text>
              </TouchableOpacity>
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

      {/* User Filter Dropdown Modal */}
      <Modal visible={showUserDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowUserDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              <TouchableOpacity
                style={[styles.dropdownItem, tempUserFilter === null && styles.dropdownItemSelected]}
                onPress={() => { setTempUserFilter(null); setShowUserDropdown(false); }}
              >
                <Text style={styles.dropdownItemText}>Svi korisnici</Text>
                {tempUserFilter === null && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {users.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.dropdownItem, tempUserFilter === u.id && styles.dropdownItemSelected]}
                  onPress={() => { setTempUserFilter(u.id); setShowUserDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{u.full_name || u.username}</Text>
                  {tempUserFilter === u.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Action Filter Dropdown Modal */}
      <Modal visible={showActionDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowActionDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              {ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.value || 'all'}
                  style={[styles.dropdownItem, tempActionFilter === action.value && styles.dropdownItemSelected]}
                  onPress={() => { setTempActionFilter(action.value); setShowActionDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{action.label}</Text>
                  {tempActionFilter === action.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Filter Dropdown Modal */}
      <Modal visible={showYearDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowYearDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              {YEARS.map((year) => (
                <TouchableOpacity
                  key={year.value || 'all'}
                  style={[styles.dropdownItem, tempYearFilter === year.value && styles.dropdownItemSelected]}
                  onPress={() => { setTempYearFilter(year.value); setShowYearDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{year.label}</Text>
                  {tempYearFilter === year.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Month Filter Dropdown Modal */}
      <Modal visible={showMonthDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowMonthDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              {MONTHS.map((month) => (
                <TouchableOpacity
                  key={month.value || 'all'}
                  style={[styles.dropdownItem, tempMonthFilter === month.value && styles.dropdownItemSelected]}
                  onPress={() => { setTempMonthFilter(month.value); setShowMonthDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{month.label}</Text>
                  {tempMonthFilter === month.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Day Filter Dropdown Modal */}
      <Modal visible={showDayDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowDayDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <ScrollView style={styles.dropdownScroll}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day.value || 'all'}
                  style={[styles.dropdownItem, tempDayFilter === day.value && styles.dropdownItemSelected]}
                  onPress={() => { setTempDayFilter(day.value); setShowDayDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{day.label}</Text>
                  {tempDayFilter === day.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Dropdown Modal */}
      <Modal visible={showSortDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'desc' && styles.dropdownItemSelected]}
              onPress={() => { setTempSortOrder('desc'); setShowSortDropdown(false); }}
            >
              <Text style={styles.dropdownItemText}>↓ Silazno (najnovije prvo)</Text>
              {tempSortOrder === 'desc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'asc' && styles.dropdownItemSelected]}
              onPress={() => { setTempSortOrder('asc'); setShowSortDropdown(false); }}
            >
              <Text style={styles.dropdownItemText}>↑ Uzlazno (najstarije prvo)</Text>
              {tempSortOrder === 'asc' && <Text style={styles.checkmark}>✓</Text>}
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
    padding: 20,
    backgroundColor: '#F7F4D5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#0A3323',
  },
  errorText: {
    fontSize: 16,
    color: '#D3968C',
  },
  listContent: {
    padding: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A3323',
  },
  filterButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#105666',
  },
  filterButtonText: {
    color: '#A6C27A',
    fontSize: 14,
    fontWeight: '600',
  },
  countText: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 8,
  },
  logCard: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#0A3323',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  actionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modelName: {
    fontSize: 14,
    color: '#105666',
    fontStyle: 'italic',
  },
  logContent: {
    marginBottom: 12,
  },
  objectRepr: {
    fontSize: 15,
    color: '#0A3323',
    lineHeight: 22,
  },
  changesContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#105666',
  },
  changesLabel: {
    fontSize: 12,
    color: '#0A3323',
    fontWeight: '600',
    marginBottom: 4,
  },
  changesText: {
    fontSize: 12,
    color: '#0A3323',
    fontFamily: 'monospace',
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0A3323',
  },
  userInfo: {
    fontSize: 13,
    color: '#105666',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 13,
    color: '#105666',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#D3968C',
    fontStyle: 'italic',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  paginationButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  paginationButtonText: {
    color: '#A6C27A',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#F7F4D5',
  },
  pageInfo: {
    fontSize: 14,
    color: '#0A3323',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: '#A6C27A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 16,
    textAlign: 'center',
  },
  filtersScroll: {
    maxHeight: 400,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 6,
    fontWeight: '500',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  picker: {
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6C27A',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 15,
    color: '#0A3323',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#0A3323',
  },
  filtersModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#A6C27A',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D3968C',
    marginRight: 'auto',
  },
  resetButtonText: {
    color: '#D3968C',
    fontSize: 14,
    fontWeight: '600',
  },
  filterCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D3968C',
  },
  filterCancelButtonText: {
    color: '#D3968C',
    fontSize: 14,
    fontWeight: '600',
  },
  filterApplyButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterApplyButtonText: {
    color: '#A6C27A',
    fontSize: 14,
    fontWeight: '600',
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
    padding: 8,
    width: '80%',
    maxHeight: 350,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#A6C27A',
  },
  dropdownScroll: {
    maxHeight: 330,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  dropdownItemSelected: {
    backgroundColor: '#0A3323',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#0A3323',
  },
  checkmark: {
    fontSize: 16,
    color: '#105666',
    fontWeight: 'bold',
  },
});
