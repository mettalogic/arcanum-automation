#ifndef FILEDATA_H
#define FILEDATA_H

#include <QString>
#include <QTextEdit>
#include <QTreeWidget>
#include <QJsonDocument>
#include <QByteArray>


/*
 A class to hold data on file.
 Should be able to get raw contents, but also parse data into tree or similar.
 */
class FileData
{
public:
	FileData() : rawdata(nullptr) {}
	FileData(const QString fname, size_t sz);

	void highlight(QTextEdit* edt, int startline, int endline, int starthl, int endhl, QColor bg = Qt::yellow, QColor fg = Qt::red);
	void populateRawData(QTextEdit* edt);
	void populateParsedData(QTextEdit* edt);
	void populateTree(QTreeWidget* tree);
	void populateWiki(QTextEdit* edt);
	int populateSearch(QTextEdit* tbl, const QString& search, QString& html, QString& wiki);	// return number of matches

private:
	QString name;	// name of class of data == name of file without extension
	size_t size;
	const char* rawdata;
	QByteArray array;
	QJsonDocument json;

	void append(QTextEdit* edt, const QString& s) { edt->insertPlainText("\n" + s); }
	void wiki_table(QTextEdit* edt) { edt->append("{| class=\"wikitable\""); wiki_row(edt); }
	void wiki_table_sortable(QTextEdit* edt) { edt->append("{| class=\"wikitable sortable\""); wiki_row(edt); }
	void wiki_row(QTextEdit* edt) { edt->append("|-"); }
	void wiki_trailer(QTextEdit* edt) { edt->append("|}"); }

	QString json_lookup(const QJsonObject& j, const QString& key);
	QString strip_string(const QString &s);
	QString strip_field(const QString &s, const QString& field);
	QString initial_caps(const QString &s);
	QString join_fields(const QJsonObject& j, const QString& f1, const QString& f2) {
		QString s1 = json_lookup(j, f1); QString s2 = json_lookup(j, f2);
		return (s1 != "" && s2 != "") ? s1 + ", " + s2 : s1 + s2; }	// join 2 fields with possibly a comma
	QString name_or_id(const QJsonObject& j) { QString s = json_lookup(j, "name"); if (s == "") s = json_lookup(j, "id"); return initial_caps(s); }
	QString highlight_string(const QString& s, const QString& search);
	QString escape_wiki(const QString& s);
};

#endif // FILEDATA_H
