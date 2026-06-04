class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String mobile;
  final String dob;
  final String gender;
  final String country;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.mobile,
    required this.dob,
    required this.gender,
    required this.country,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'user',
      mobile: json['mobile'] ?? '',
      dob: json['dob'] ?? '',
      gender: json['gender'] ?? '',
      country: json['country'] ?? '',
    );
  }
}

class AppointmentModel {
  final String id;
  final String status;
  final String date;
  final String time;
  final String problem;
  final String doctorName;
  final String doctorId;
  final String paymentGateway;
  final String paymentStatus;

  AppointmentModel({
    required this.id,
    required this.status,
    required this.date,
    required this.time,
    required this.problem,
    required this.doctorName,
    required this.doctorId,
    required this.paymentGateway,
    required this.paymentStatus,
  });

  factory AppointmentModel.fromJson(Map<String, dynamic> json) {
    final doctor = json['doctorId'];
    return AppointmentModel(
      id: json['_id'] ?? '',
      status: json['status'] ?? '',
      date: json['date'] ?? '',
      time: json['time'] ?? '',
      problem: json['problem'] ?? '',
      doctorName: doctor is Map ? (doctor['name'] ?? 'Unknown Doctor') : 'Unknown Doctor',
      doctorId: doctor is Map ? (doctor['_id'] ?? '') : (json['doctorId'] ?? ''),
      paymentGateway: json['paymentGateway'] ?? '',
      paymentStatus: json['paymentStatus'] ?? '',
    );
  }
}

class QuestionModel {
  final String id;
  final String question;
  final String status;
  final String answer;
  final String category;

  QuestionModel({
    required this.id,
    required this.question,
    required this.status,
    required this.answer,
    required this.category,
  });

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    return QuestionModel(
      id: json['_id'] ?? '',
      question: json['question'] ?? '',
      status: json['status'] ?? '',
      answer: json['answer'] ?? '',
      category: json['category'] ?? '',
    );
  }
}

class RecordModel {
  final String id;
  final String title;
  final String type;
  final String doctorName;
  final String date;
  final String details;

  RecordModel({
    required this.id,
    required this.title,
    required this.type,
    required this.doctorName,
    required this.date,
    required this.details,
  });

  factory RecordModel.fromPrescriptionJson(Map<String, dynamic> json) {
    return RecordModel(
      id: json['_id'] ?? '',
      title: json['diagnosis'] ?? 'Prescription',
      type: 'prescription',
      doctorName: json['doctorId']?['name'] ?? 'Doctor',
      date: json['createdAt'] ?? '',
      details: json['medicines']?.join(', ') ?? '',
    );
  }

  factory RecordModel.fromCertificateJson(Map<String, dynamic> json) {
    return RecordModel(
      id: json['_id'] ?? '',
      title: json['diagnosis'] ?? 'Medical Certificate',
      type: 'certificate',
      doctorName: json['doctorId']?['name'] ?? 'Doctor',
      date: json['issuedDate'] ?? json['createdAt'] ?? '',
      details: json['recommendation'] ?? '',
    );
  }
}

class TicketModel {
  final String id;
  final String title;
  final String status;
  final String description;

  TicketModel({
    required this.id,
    required this.title,
    required this.status,
    required this.description,
  });

  factory TicketModel.fromJson(Map<String, dynamic> json) {
    return TicketModel(
      id: json['_id'] ?? '',
      title: json['title'] ?? json['subject'] ?? 'Support Ticket',
      status: json['status'] ?? '',
      description: json['description'] ?? json['message'] ?? '',
    );
  }
}

class DoctorModel {
  final String id;
  final String name;
  final String specialty;
  final double fee;
  final String location;

  DoctorModel({
    required this.id,
    required this.name,
    required this.specialty,
    required this.fee,
    required this.location,
  });

  factory DoctorModel.fromJson(Map<String, dynamic> json) {
    return DoctorModel(
      id: json['_id'] ?? json['doctorId']?.toString() ?? '',
      name: json['name'] ?? 'Doctor',
      specialty: json['specialty'] ?? 'General',
      fee: (json['consultantFees'] ?? json['price'] ?? 0).toDouble(),
      location: json['clinicAddress'] ?? json['location'] ?? '',
    );
  }
}
