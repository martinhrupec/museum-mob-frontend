import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import { crossAlert } from '../utils/alert';
import { useAuthStore } from '../store/authStore';
import {
  getReceptionReports,
  createReceptionReport,
  getAssignmentSnapshotThisWeek,
  getExhibitions,
} from '../api/endpoints';
import { ReceptionReport, AssignmentPosition, AssignmentSnapshot, Exhibition } from '../types';

type SortOrder = 'asc' | 'desc';

export default function ReceptionReportsScreen() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<ReceptionReport[]>([]);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  
  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [exhibitionFilter, setExhibitionFilter] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showExhibitionDropdown, setShowExhibitionDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Temp state za filter modal (primjenjuje se tek na "Primijeni")
  const [tempExhibitionFilter, setTempExhibitionFilter] = useState<number | null>(null);
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('desc');
  
  // Create Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [thisWeekSnapshot, setThisWeekSnapshot] = useState<AssignmentSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [reportText, setReportText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isGuard = user?.role === 'guard';

  // Funkcije za filter modal
  const openFiltersModal = () => {
    setTempExhibitionFilter(exhibitionFilter);
    setTempSortOrder(sortOrder);
    setShowFiltersModal(true);
  };

  const applyFilters = () => {
    setExhibitionFilter(tempExhibitionFilter);
    setSortOrder(tempSortOrder);
    setShowFiltersModal(false);
  };

  const cancelFilters = () => {
    setShowFiltersModal(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reload when filters or sort changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      fetchData(1);
    }
  }, [exhibitionFilter, sortOrder]);

  const fetchData = async (pageNum: number = page) => {
    try {
      setLoading(true);
      
      // Build filters for backend
      const filters: any = {};
      
      if (exhibitionFilter !== null) {
        filters.exhibition_id = exhibitionFilter;
      }
      
      // Ordering: created_at or -created_at
      filters.ordering = sortOrder === 'asc' ? 'created_at' : '-created_at';
      
      const [reportsRes, exhibitionsRes] = await Promise.all([
        getReceptionReports(pageNum, filters),
        getExhibitions(),
      ]);
      
      // Extract results from paginated response
      const reportsList = reportsRes.results || [];
      setReports(reportsList);
      
      // Set pagination data for reports
      setNext(reportsRes.next || null);
      setPrev(reportsRes.previous || null);
      setCount(reportsRes.count || 0);
      
      // Extract exhibitions (might be paginated now)
      const exhibitionsList = Array.isArray(exhibitionsRes) ? exhibitionsRes : (exhibitionsRes.results || []);
      setExhibitions(exhibitionsList);
    } catch (error) {
      console.error('Error fetching data:', error);
      crossAlert('Greška', 'Nije moguće učitati prijave.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Frontend search filter only (backend doesn't support partial text search)
  const filteredBySearch = useMemo(() => {
    if (!searchText.trim()) {
      return reports;
    }
    
    const search = searchText.toLowerCase();
    return reports.filter(r => 
      r.report_text.toLowerCase().includes(search) ||
      r.guard.full_name.toLowerCase().includes(search)
    );
  }, [reports, searchText]);

  // Dohvati pozicije za ovaj tjedan kad se otvori modal
  const openCreateModal = async () => {
    setModalVisible(true);
    setSnapshotLoading(true);
    try {
      const snapshot = await getAssignmentSnapshotThisWeek();
      setThisWeekSnapshot(snapshot);
    } catch (error) {
      console.error('Error fetching this week snapshot:', error);
      crossAlert('Greška', 'Nije moguće učitati pozicije.');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPositionId(null);
    setReportText('');
    setThisWeekSnapshot(null);
  };

  // Filtriraj samo pozicije koje su trenutno u tijeku (todayOnly + trenutno vrijeme)
  const currentlyActivePositions = useMemo(() => {
    if (!thisWeekSnapshot || !user || user.role !== 'guard') return [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().slice(0, 8); // HH:mm:ss

    const guardId = user.guard_profile?.id;
    if (!guardId) return [];

    return thisWeekSnapshot.positions.filter((p) => {
      // Pozicija mora biti danas
      if (p.position.date !== todayStr) return false;

      // Pozicija mora biti u tijeku (između start_time i end_time)
      if (currentTime < p.position.start_time || currentTime > p.position.end_time) return false;

      return true;
    });
  }, [thisWeekSnapshot, user]);

  const handleSubmit = async () => {
    if (!selectedPositionId) {
      crossAlert('Greška', 'Molimo odaberite poziciju.');
      return;
    }
    if (!reportText.trim()) {
      crossAlert('Greška', 'Molimo unesite kratki opis problema.');
      return;
    }

    setSubmitting(true);
    try {
      await createReceptionReport({
        position_id: selectedPositionId,
        report_text: reportText.trim(),
      });
      crossAlert('Uspjeh', 'Prijava je uspješno poslana recepciji.');
      closeModal();
      fetchData();
    } catch (error: any) {
      console.error('Error creating report:', error);
      const errorMessage = error.response?.data?.detail 
        || error.response?.data?.error 
        || 'Nije moguće poslati prijavu.';
      crossAlert('Greška', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year}. ${hours}:${minutes}`;
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5); // HH:mm
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}.`;
  };

  const renderReportItem = ({ item }: { item: ReceptionReport }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportGuard}>{item.guard.full_name}</Text>
        <Text style={styles.reportDate}>{formatDateTime(item.created_at)}</Text>
      </View>
      <View style={styles.positionInfo}>
        <Text style={styles.reportText}>{item.report_text}</Text>
      </View>
      <Text style={styles.exhibitionName}>{item.position.exhibition_name}</Text>
      <Text style={styles.positionTime}>
        {formatDate(item.position.date)} | {formatTime(item.position.start_time)} - {formatTime(item.position.end_time)}
      </Text>
    </View>
  );

  const renderPositionOption = (position: AssignmentPosition) => {
    const isSelected = selectedPositionId === position.position.id;
    return (
      <TouchableOpacity
        key={position.position.id}
        style={[styles.positionOption, isSelected && styles.positionOptionSelected]}
        onPress={() => setSelectedPositionId(position.position.id)}
        disabled={submitting}
      >
        <Text style={[styles.positionOptionText, isSelected && styles.positionOptionTextSelected]}>
          {position.position.exhibition_name}
        </Text>
        <Text style={[styles.positionOptionTime, isSelected && styles.positionOptionTextSelected]}>
          {formatTime(position.position.start_time)} - {formatTime(position.position.end_time)}
        </Text>
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
      {/* Header sa search barom i filterima */}
      <View style={styles.header}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Pretraži prijave..."
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            returnKeyType="search"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={openFiltersModal}
          >
            <Text style={styles.filterIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Active filters display */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFilters}>
          {exhibitionFilter !== null && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Izložba: {exhibitions.find(e => e.id === exhibitionFilter)?.name || 'Nepoznato'}
              </Text>
              <TouchableOpacity onPress={() => setExhibitionFilter(null)}>
                <Text style={styles.filterChipClose}> ✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>
              Datum: {sortOrder === 'asc' ? '↑ Najstarije' : '↓ Najnovije'}
            </Text>
          </View>
        </ScrollView>

        {/* Button za kreiranje prijave - samo guard */}
        {isGuard && (
          <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
            <Text style={styles.createButtonText}>+ Nova prijava</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista reportova */}
      {filteredBySearch.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {reports.length === 0 ? 'Nema prijava recepciji.' : 'Nema rezultata za traženi pojam.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBySearch}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Pagination Controls */}
      {!loading && (prev || next) && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity 
            style={[styles.paginationButton, !prev && styles.paginationButtonDisabled]}
            onPress={() => {
              if (prev) {
                const newPage = Math.max(1, page - 1);
                setPage(newPage);
                fetchData(newPage);
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
                fetchData(newPage);
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

      {/* Filter/Sort Modal */}
      <Modal visible={showFiltersModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.filtersModalContent}>            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* FILTERI */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>FILTERI</Text>
                
                <Text style={styles.label}>Izložba</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowExhibitionDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempExhibitionFilter === null 
                        ? 'Sve izložbe' 
                        : exhibitions.find(e => e.id === tempExhibitionFilter)?.name || 'Nepoznato'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SORTIRANJE */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>SORTIRANJE</Text>
                
                <Text style={styles.label}>Redoslijed po datumu</Text>
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

      {/* Exhibition Dropdown Modal */}
      <Modal visible={showExhibitionDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          onPress={() => setShowExhibitionDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <TouchableOpacity
              style={[styles.dropdownItem, tempExhibitionFilter === null && styles.dropdownItemSelected]}
              onPress={() => { setTempExhibitionFilter(null); setShowExhibitionDropdown(false); }}
            >
              <Text style={[styles.dropdownItemText, tempExhibitionFilter === null && styles.dropdownItemTextSelected]}>Sve izložbe</Text>
              {tempExhibitionFilter === null && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            {exhibitions.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={[styles.dropdownItem, tempExhibitionFilter === ex.id && styles.dropdownItemSelected]}
                onPress={() => { setTempExhibitionFilter(ex.id); setShowExhibitionDropdown(false); }}
              >
                <Text style={[styles.dropdownItemText, tempExhibitionFilter === ex.id && styles.dropdownItemTextSelected]}>{ex.name}</Text>
                {tempExhibitionFilter === ex.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Order Dropdown Modal */}
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
              <Text style={[styles.dropdownItemText, tempSortOrder === 'desc' && styles.dropdownItemTextSelected]}>↓ Silazno (najnovije prvo)</Text>
              {tempSortOrder === 'desc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'asc' && styles.dropdownItemSelected]}
              onPress={() => { setTempSortOrder('asc'); setShowSortDropdown(false); }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'asc' && styles.dropdownItemTextSelected]}>↑ Uzlazno (najstarije prvo)</Text>
              {tempSortOrder === 'asc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal za kreiranje prijave */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.overlay} onPress={closeModal}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nova prijava recepciji</Text>

            {snapshotLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#0A3323" />
                <Text style={styles.modalLoadingText}>Učitavanje pozicija...</Text>
              </View>
            ) : currentlyActivePositions.length === 0 ? (
              <View style={styles.noPositions}>
                <Text style={styles.noPositionsText}>
                  Nemate aktivnih pozicija u ovom trenutku.
                </Text>
                <Text style={styles.noPositionsSubtext}>
                  Prijave se mogu slati samo tijekom trajanja vaših pozicija.
                </Text>
              </View>
            ) : (
              <>
                {/* Odabir pozicije */}
                <Text style={styles.inputLabel}>Odaberite poziciju:</Text>
                <ScrollView style={styles.positionsList} nestedScrollEnabled>
                  {currentlyActivePositions.map(renderPositionOption)}
                </ScrollView>

                {/* Opis problema */}
                <Text style={styles.inputLabel}>Kratki opis problema:</Text>
                <TextInput
                  style={styles.textInput}
                  value={reportText}
                  onChangeText={setReportText}
                  placeholder="Opišite problem..."
                  multiline
                  numberOfLines={4}
                  autoComplete="off"
                  autoCorrect={false}
                  editable={!submitting}
                />
              </>
            )}

            {/* Buttoni */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              {currentlyActivePositions.length > 0 && (
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting || !selectedPositionId || !reportText.trim()}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Pošalji</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
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
    backgroundColor: '#A6C27A',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  // Search bar styles
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  searchIcon: {
    fontSize: 16,
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 10,
    paddingLeft: 35,
    paddingRight: 35,
    fontSize: 15,
    backgroundColor: '#F7F4D5',
    color: '#0A3323',
  },
  clearButton: {
    position: 'absolute',
    right: 55,
    padding: 4,
  },
  clearIcon: {
    fontSize: 18,
    color: '#D3968C',
  },
  filterIconButton: {
    backgroundColor: '#0A3323',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: 45,
    marginLeft: 10,
  },
  filterIconText: {
    fontSize: 20,
  },
  // Active filters
  activeFilters: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#105666',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    color: '#A6C27A',
    fontWeight: '500',
  },
  filterChipClose: {
    fontSize: 14,
    color: '#A6C27A',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#0A3323',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  createButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#D3968C',
    fontStyle: 'italic',
  },
  reportCard: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportGuard: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3323',
  },
  reportDate: {
    fontSize: 14,
    color: '#0A3323',
    fontWeight: '600',
  },
  positionInfo: {
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  exhibitionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 4,
  },
  positionTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A3323',
  },
  reportText: {
    fontSize: 14,
    color: '#0A3323',
    fontWeight: '600',
    lineHeight: 20,
  },
  // Filter Modal styles
  filtersModalContent: {
    backgroundColor: '#A6C27A',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  filterSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0A3323',
    marginBottom: 6,
    marginTop: 8,
  },
  pickerContainer: {
    marginBottom: 8,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F7F4D5',
  },
  pickerText: {
    fontSize: 14,
    color: '#0A3323',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#D3968C',
  },
  filtersModalFooter: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  filterCancelButton: {
    flex: 1,
    backgroundColor: '#D3968C',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterCancelButtonText: {
    color: '#0A3323',
    fontWeight: '600',
    fontSize: 16,
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  filterApplyButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 16,
  },
  // Dropdown styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 8,
    width: '80%',
    maxWidth: 350,
    maxHeight: '60%',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
  },
  dropdownItemSelected: {
    backgroundColor: '#105666',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#0A3323',
  },
  dropdownItemTextSelected: {
    color: '#FFFFFF',
  },
  checkmark: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Create Modal styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#A6C27A',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#D3968C',
  },
  noPositions: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noPositionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3323',
    textAlign: 'center',
    marginBottom: 8,
  },
  noPositionsSubtext: {
    fontSize: 15,
    color: '#0A3323',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 8,
    marginTop: 12,
  },
  positionsList: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
  },
  positionOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  positionOptionSelected: {
    backgroundColor: '#105666',
  },
  positionOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0A3323',
  },
  positionOptionTime: {
    fontSize: 12,
    color: '#D3968C',
    marginTop: 2,
  },
  positionOptionTextSelected: {
    color: '#F7F4D5',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#F7F4D5',
    color: '#0A3323',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#0A3323',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  submitButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  submitButtonText: {
    fontSize: 14,
    color: '#A6C27A',
    fontWeight: '600',
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
