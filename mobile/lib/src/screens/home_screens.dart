import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../services/stripe_service.dart';
import '../utils/constants.dart';
import '../widgets/common_widgets.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _currentIndex = 0;

  static const _screens = [
    DashboardScreen(),
    AppointmentsScreen(),
    MedicalQuestionsScreen(),
    MedicalRecordsScreen(),
    ProfileScreen(),
  ];

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: AppBottomNavigation(currentIndex: _currentIndex, onTap: _onTabTapped),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _error;
  List<AppointmentModel> _appointments = [];
  List<QuestionModel> _questions = [];
  List<TicketModel> _tickets = [];
  int _prescriptions = 0;
  int _certificates = 0;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final apptData = await auth.fetchList('/api/appointments/mine');
      final qnaData = await auth.fetchList('/api/qna/user-questions');
      final ticketData = await auth.fetchList('/api/tickets/user/my');
      final rxData = await auth.fetchList('/api/medical/my-prescriptions');
      final certData = await auth.fetchList('/api/medical/my-certificates');

      setState(() {
        _appointments = apptData.map((item) => AppointmentModel.fromJson(item)).toList();
        _questions = qnaData.map((item) => QuestionModel.fromJson(item)).toList();
        _tickets = ticketData.map((item) => TicketModel.fromJson(item)).toList();
        _prescriptions = rxData.length;
        _certificates = certData.length;
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final name = auth.user?.name.split(' ').first ?? 'there';
    if (_loading) return const Scaffold(body: AppLoading());
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hi, $name', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Your health overview at a glance.', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 24),
            if (_error != null) AppErrorBanner(_error!),
            AppSectionCard(
              title: 'Summary',
              child: Column(
                children: [
                  AppSummaryTile(label: 'Total Appointments', value: '${_appointments.length}'),
                  AppSummaryTile(label: 'Active Questions', value: '${_questions.length}'),
                  AppSummaryTile(label: 'Open Tickets', value: '${_tickets.where((item) => item.status != 'resolved').length}'),
                ],
              ),
            ),
            AppSectionCard(
              title: 'Medical Records',
              child: Column(
                children: [
                  AppSummaryTile(label: 'Prescriptions', value: '$_prescriptions'),
                  AppSummaryTile(label: 'Certificates', value: '$_certificates'),
                ],
              ),
            ),
            AppSectionCard(
              title: 'Quick Actions',
              action: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AppointmentsScreen())),
              actionLabel: 'View Appointments',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ElevatedButton.icon(
                    icon: const Icon(Icons.add),
                    label: const Text('Book Appointment'),
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BookAppointmentScreen())),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.question_answer),
                    label: const Text('Ask Medical Question'),
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AskQuestionScreen())),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  bool _loading = true;
  String? _error;
  List<AppointmentModel> _appointments = [];

  @override
  void initState() {
    super.initState();
    _loadAppointments();
  }

  Future<void> _loadAppointments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final list = await auth.fetchList('/api/appointments/mine');
      setState(() {
        _appointments = list.map((item) => AppointmentModel.fromJson(item)).toList();
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: AppLoading());
    return Scaffold(
      appBar: AppBar(title: const Text('Appointments')),
      body: RefreshIndicator(
        onRefresh: _loadAppointments,
        child: _appointments.isEmpty
            ? ListView(children: const [Padding(padding: EdgeInsets.all(24), child: Text('No appointments yet.'))])
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _appointments.length,
                itemBuilder: (context, index) {
                  final item = _appointments[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text('Dr. ${item.doctorName}'),
                      subtitle: Text('${item.date} · ${item.time}\nStatus: ${item.status}'),
                      isThreeLine: true,
                      trailing: const Icon(Icons.arrow_forward_ios, size: 18),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppointmentDetailScreen(appointment: item))),
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Book'),
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BookAppointmentScreen())),
      ),
    );
  }
}

class AppointmentDetailScreen extends StatelessWidget {
  final AppointmentModel appointment;
  const AppointmentDetailScreen({super.key, required this.appointment});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Appointment Details')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Dr. ${appointment.doctorName}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Status: ${appointment.status}', style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 16),
            Text('Date: ${appointment.date}', style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text('Time: ${appointment.time}', style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text('Problem: ${appointment.problem}', style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 16),
            Text('Payment Gateway: ${appointment.paymentGateway}', style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text('Payment Status: ${appointment.paymentStatus}', style: const TextStyle(fontSize: 16)),
          ],
        ),
      ),
    );
  }
}

class BookAppointmentScreen extends StatefulWidget {
  const BookAppointmentScreen({super.key});

  @override
  State<BookAppointmentScreen> createState() => _BookAppointmentScreenState();
}

class _BookAppointmentScreenState extends State<BookAppointmentScreen> {
  bool _loading = true;
  bool _booking = false;
  String? _error;
  List<DoctorModel> _doctors = [];
  DoctorModel? _selectedDoctor;
  String _date = '';
  String _time = '';
  final _problemController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchDoctors();
  }

  Future<void> _fetchDoctors() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final list = await auth.fetchList('/api/doctor/approved');
      setState(() {
        _doctors = list.map((item) => DoctorModel.fromJson(item)).toList();
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _bookAppointment() async {
    if (_selectedDoctor == null || _date.isEmpty || _time.isEmpty || _problemController.text.trim().isEmpty) {
      setState(() {
        _error = 'Doctor, date, time and problem description are required.';
      });
      return;
    }
    if (!StripeService.isAvailable) {
      setState(() {
        _error = 'Stripe payment is not configured. Please set your publishable key in .env.';
      });
      return;
    }
    setState(() {
      _booking = true;
      _error = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final paymentResponse = await auth.post<Map<String, dynamic>>('/api/payments/create-intent', body: {'doctorId': _selectedDoctor!.id});
      final clientSecret = paymentResponse['clientSecret'] as String?;
      if (clientSecret == null) throw 'Failed to create payment intent.';
      await StripeService.presentPaymentSheet(clientSecret: clientSecret, merchantName: AppConstants.appName);
      await auth.post<Map<String, dynamic>>('/api/appointments', body: {
        'doctorId': _selectedDoctor!.id,
        'date': _date,
        'time': _time,
        'problem': _problemController.text.trim(),
        'paymentIntentId': paymentResponse['clientSecret']?.split('_secret')?.first,
      });
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Booked'),
          content: const Text('Your appointment has been booked successfully.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK')),
          ],
        ),
      );
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _booking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: AppLoading());
    return Scaffold(
      appBar: AppBar(title: const Text('Book Appointment')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            if (_error != null) AppErrorBanner(_error!),
            DropdownButtonFormField<DoctorModel>(
              value: _selectedDoctor,
              items: _doctors
                  .map((doctor) => DropdownMenuItem(value: doctor, child: Text('${doctor.name} · ${doctor.specialty}')))
                  .toList(),
              onChanged: (value) => setState(() => _selectedDoctor = value),
              decoration: const InputDecoration(labelText: 'Select Doctor'),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(labelText: 'Preferred Date (YYYY-MM-DD)'),
              onChanged: (value) => _date = value.trim(),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(labelText: 'Preferred Time (HH:MM)'),
              onChanged: (value) => _time = value.trim(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _problemController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Problem description'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _booking ? null : _bookAppointment,
              child: _booking ? const CircularProgressIndicator(color: Colors.white) : const Text('Pay and Book'),
            ),
          ],
        ),
      ),
    );
  }
}

class MedicalQuestionsScreen extends StatefulWidget {
  const MedicalQuestionsScreen({super.key});

  @override
  State<MedicalQuestionsScreen> createState() => _MedicalQuestionsScreenState();
}

class _MedicalQuestionsScreenState extends State<MedicalQuestionsScreen> {
  bool _loading = true;
  String? _error;
  List<QuestionModel> _questions = [];

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final list = await auth.fetchList('/api/qna/user-questions');
      setState(() {
        _questions = list.map((item) => QuestionModel.fromJson(item)).toList();
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: AppLoading());
    return Scaffold(
      appBar: AppBar(title: const Text('Medical Questions')),
      body: RefreshIndicator(
        onRefresh: _loadQuestions,
        child: _questions.isEmpty
            ? ListView(children: const [Padding(padding: EdgeInsets.all(24), child: Text('No medical questions submitted.'))])
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _questions.length,
                itemBuilder: (context, index) {
                  final question = _questions[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(question.question),
                      subtitle: Text('Status: ${question.status}'),
                      trailing: question.answer.isNotEmpty ? const Icon(Icons.check_circle, color: AppColors.success) : null,
                      onTap: () {
                        showDialog(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: Text('Question details'),
                            content: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Question: ${question.question}'),
                                const SizedBox(height: 12),
                                Text('Answer: ${question.answer.isNotEmpty ? question.answer : 'Awaiting response.'}'),
                              ],
                            ),
                            actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close'))],
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Ask Question'),
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AskQuestionScreen())),
      ),
    );
  }
}

class AskQuestionScreen extends StatefulWidget {
  const AskQuestionScreen({super.key});

  @override
  State<AskQuestionScreen> createState() => _AskQuestionScreenState();
}

class _AskQuestionScreenState extends State<AskQuestionScreen> {
  final _questionController = TextEditingController();
  final _categoryController = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _success;

  Future<void> _submit() async {
    if (_questionController.text.trim().isEmpty) {
      setState(() {
        _error = 'Question cannot be empty.';
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.post<Map<String, dynamic>>('/api/qna/ask', body: {
        'question': _questionController.text.trim(),
        'category': _categoryController.text.trim().isEmpty ? 'General' : _categoryController.text.trim(),
      });
      setState(() {
        _success = 'Your question has been submitted.';
        _questionController.clear();
        _categoryController.clear();
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ask Medical Question')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (_error != null) AppErrorBanner(_error!),
            if (_success != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(_success!, style: const TextStyle(color: AppColors.success)),
              ),
            TextField(
              controller: _questionController,
              minLines: 4,
              maxLines: 6,
              decoration: const InputDecoration(labelText: 'Your medical question'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _categoryController,
              decoration: const InputDecoration(labelText: 'Category (optional)'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Submit Question'),
            ),
          ],
        ),
      ),
    );
  }
}

class MedicalRecordsScreen extends StatefulWidget {
  const MedicalRecordsScreen({super.key});

  @override
  State<MedicalRecordsScreen> createState() => _MedicalRecordsScreenState();
}

class _MedicalRecordsScreenState extends State<MedicalRecordsScreen> {
  bool _loading = true;
  String? _error;
  List<RecordModel> _records = [];

  @override
  void initState() {
    super.initState();
    _loadRecords();
  }

  Future<void> _loadRecords() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final rxData = await auth.fetchList('/api/medical/my-prescriptions');
      final certData = await auth.fetchList('/api/medical/my-certificates');
      setState(() {
        _records = [
          ...rxData.map((item) => RecordModel.fromPrescriptionJson(item)),
          ...certData.map((item) => RecordModel.fromCertificateJson(item)),
        ];
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: AppLoading());
    return Scaffold(
      appBar: AppBar(title: const Text('Medical Records')),
      body: RefreshIndicator(
        onRefresh: _loadRecords,
        child: _records.isEmpty
            ? ListView(children: const [Padding(padding: EdgeInsets.all(24), child: Text('No medical records available yet.'))])
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _records.length,
                itemBuilder: (context, index) {
                  final record = _records[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(record.title),
                      subtitle: Text('${record.type} · ${record.date}\nDoctor: ${record.doctorName}'),
                      isThreeLine: true,
                      onTap: () => showDialog(
                        context: context,
                        builder: (_) => AlertDialog(
                          title: Text(record.title),
                          content: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Type: ${record.type}'),
                              const SizedBox(height: 8),
                              Text('Date: ${record.date}'),
                              const SizedBox(height: 8),
                              Text('Doctor: ${record.doctorName}'),
                              const SizedBox(height: 8),
                              Text('Details: ${record.details}'),
                            ],
                          ),
                          actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close'))],
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class SupportTicketsScreen extends StatefulWidget {
  const SupportTicketsScreen({super.key});

  @override
  State<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends State<SupportTicketsScreen> {
  bool _loading = true;
  String? _error;
  List<TicketModel> _tickets = [];

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final list = await auth.fetchList('/api/tickets/user/my');
      setState(() {
        _tickets = list.map((item) => TicketModel.fromJson(item)).toList();
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: AppLoading());
    return Scaffold(
      appBar: AppBar(title: const Text('Support Tickets')),
      body: RefreshIndicator(
        onRefresh: _loadTickets,
        child: _tickets.isEmpty
            ? ListView(children: const [Padding(padding: EdgeInsets.all(24), child: Text('No support tickets yet.'))])
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _tickets.length,
                itemBuilder: (context, index) {
                  final ticket = _tickets[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(ticket.title),
                      subtitle: Text('Status: ${ticket.status}'),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TicketDetailScreen(ticket: ticket))),
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Raise Ticket'),
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NewTicketScreen())).then((_) => _loadTickets()),
      ),
    );
  }
}

class TicketDetailScreen extends StatelessWidget {
  final TicketModel ticket;
  const TicketDetailScreen({super.key, required this.ticket});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ticket Details')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ticket.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Text('Status: ${ticket.status}'),
            const SizedBox(height: 12),
            Text(ticket.description),
          ],
        ),
      ),
    );
  }
}

class NewTicketScreen extends StatefulWidget {
  const NewTicketScreen({super.key});

  @override
  State<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends State<NewTicketScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _submitting = false;
  String? _error;

  Future<void> _submitTicket() async {
    if (_titleController.text.trim().isEmpty || _descriptionController.text.trim().isEmpty) {
      setState(() {
        _error = 'Title and description are required.';
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.post<Map<String, dynamic>>('/api/tickets/user/create', body: {
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim(),
      });
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Raise New Ticket')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) AppErrorBanner(_error!),
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              minLines: 4,
              maxLines: 7,
              decoration: const InputDecoration(labelText: 'Describe your issue'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitting ? null : _submitTicket,
              child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Submit Ticket'),
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(auth.user?.name ?? '', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(auth.user?.email ?? ''),
            const SizedBox(height: 16),
            AppSectionCard(
              title: 'Contact',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Mobile: ${auth.user?.mobile ?? 'Not set'}'),
                  const SizedBox(height: 8),
                  Text('Country: ${auth.user?.country ?? 'Not set'}'),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EditProfileScreen())),
              child: const Text('Edit Profile'),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
              child: const Text('Change Password'),
            ),
            const Spacer(),
            OutlinedButton(
              onPressed: () async {
                await auth.logout();
              },
              child: const Text('Logout'),
            ),
          ],
        ),
      ),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _mobileController;
  late final TextEditingController _dobController;
  late final TextEditingController _countryController;
  String _gender = 'male';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _nameController = TextEditingController(text: auth.user?.name);
    _emailController = TextEditingController(text: auth.user?.email);
    _mobileController = TextEditingController(text: auth.user?.mobile);
    _dobController = TextEditingController(text: auth.user?.dob);
    _countryController = TextEditingController(text: auth.user?.country);
    _gender = auth.user?.gender ?? 'male';
  }

  Future<void> _saveProfile() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.updateProfile({
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'mobile': _mobileController.text.trim(),
        'dob': _dobController.text.trim(),
        'gender': _gender,
        'country': _countryController.text.trim(),
      });
      if (mounted) Navigator.of(context).pop();
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profile')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) AppErrorBanner(_error!),
            TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Full Name')),
            const SizedBox(height: 12),
            TextField(controller: _emailController, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            TextField(controller: _mobileController, decoration: const InputDecoration(labelText: 'Mobile')),
            const SizedBox(height: 12),
            TextField(controller: _dobController, decoration: const InputDecoration(labelText: 'Date of Birth')),
            const SizedBox(height: 12),
            TextField(controller: _countryController, decoration: const InputDecoration(labelText: 'Country')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _gender,
              onChanged: (value) => setState(() => _gender = value ?? 'male'),
              items: const [
                DropdownMenuItem(value: 'male', child: Text('Male')),
                DropdownMenuItem(value: 'female', child: Text('Female')),
                DropdownMenuItem(value: 'other', child: Text('Other')),
              ],
              decoration: const InputDecoration(labelText: 'Gender'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _saving ? null : _saveProfile,
              child: _saving ? const CircularProgressIndicator(color: Colors.white) : const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  bool _submitting = false;
  String? _error;

  Future<void> _changePassword() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.changePassword(_currentController.text, _newController.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password updated successfully.')));
        Navigator.of(context).pop();
      }
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change Password')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) AppErrorBanner(_error!),
            TextField(controller: _currentController, obscureText: true, decoration: const InputDecoration(labelText: 'Current Password')),
            const SizedBox(height: 12),
            TextField(controller: _newController, obscureText: true, decoration: const InputDecoration(labelText: 'New Password')),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitting ? null : _changePassword,
              child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Update Password'),
            ),
          ],
        ),
      ),
    );
  }
}
